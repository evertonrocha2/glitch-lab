// Postgres "invalid input syntax for type uuid": a malformed id simply matches nothing.
const INVALID_UUID = '22P02'
// Postgres unique_violation: the code (or the player's rating row) already exists.
const UNIQUE_VIOLATION = '23505'

// A list shows no rounds (they hold the answers), no bot plan, answers or focus events.
const SUMMARY_COLUMNS = 'id, code, kind, status, players, start_at, finished_at, result, rematch_of, rematch_id, created_at, updated_at'

// Postgres prints "2026-10-22T15:00:00+00:00"; the app and the local store use the ISO "Z" form.
const iso = (value) => (value ? new Date(value).toISOString() : null)

const toSummary = (row) =>
  row && {
    id: row.id,
    code: row.code,
    kind: row.kind,
    status: row.status,
    players: row.players ?? [],
    startAt: iso(row.start_at),
    finishedAt: iso(row.finished_at),
    result: row.result ?? null,
    rematchOf: row.rematch_of ?? null,
    rematchId: row.rematch_id ?? null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }

const toDuel = (row) =>
  row && {
    ...toSummary(row),
    rounds: row.rounds ?? [],
    botPlan: row.bot_plan ?? null,
    answers: row.answers ?? [],
    focus: row.focus ?? [],
    version: row.version,
  }

const toRating = (row) =>
  row && { userId: row.user_id, rating: row.rating, games: row.games, wins: row.wins, losses: row.losses, draws: row.draws, updatedAt: row.updated_at }

// Who is in a duel, as a plain list the database can search ('bot' for the Glitch Bot).
const playerIds = (players) => players.map((player) => player.userId)

const COLUMNS = { status: 'status', startAt: 'start_at', finishedAt: 'finished_at', answers: 'answers', focus: 'focus', result: 'result', rematchId: 'rematch_id' }

function unwrap({ data, error }) {
  if (error?.code === INVALID_UUID) return null
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

// Duels and duel ratings on Supabase. Spread into createSupabaseStore.
export function createSupabaseDuels(db) {
  return {
    async createDuel({ code, kind, status, players, rounds, botPlan = null, startAt = null, rematchOf = null }) {
      const inserted = await db
        .from('duels')
        .insert({ code, kind, status, players, player_ids: playerIds(players), rounds, bot_plan: botPlan, start_at: startAt, rematch_of: rematchOf })
        .select()
        .single()
      if (inserted.error?.code === UNIQUE_VIOLATION) return null
      return toDuel(unwrap(inserted))
    },

    async getDuel(id) {
      return toDuel(unwrap(await db.from('duels').select('*').eq('id', id).maybeSingle()))
    },

    async findDuelByCode(code) {
      return toDuel(unwrap(await db.from('duels').select('*').eq('code', code).maybeSingle()))
    },

    // version is the check: the write lands only if nothing else saved since the duel was read.
    async updateDuel(id, fields, expectedVersion) {
      const patch = { version: expectedVersion + 1, updated_at: new Date().toISOString() }
      for (const [field, column] of Object.entries(COLUMNS)) if (fields[field] !== undefined) patch[column] = fields[field]
      if (fields.players !== undefined) {
        patch.players = fields.players
        patch.player_ids = playerIds(fields.players)
      }
      return toDuel(unwrap(await db.from('duels').update(patch).eq('id', id).eq('version', expectedVersion).select().maybeSingle()))
    },

    async listDuels(userId, { status, limit } = {}) {
      let query = db.from('duels').select(SUMMARY_COLUMNS).contains('player_ids', [userId])
      if (status !== undefined) query = query.eq('status', status)
      query = query.order('created_at', { ascending: false })
      if (limit !== undefined) query = query.limit(limit)
      return (unwrap(await query) ?? []).map(toSummary)
    },

    async findQueueDuels(userId, since, limit = 5) {
      const rows = unwrap(
        await db
          .from('duels')
          .select('*')
          .eq('kind', 'queue')
          .eq('status', 'waiting')
          .gte('updated_at', since)
          .not('player_ids', 'cs', `{${userId}}`)
          .order('created_at', { ascending: true })
          .limit(limit),
      )
      return (rows ?? []).map(toDuel)
    },

    async getRating(userId) {
      return toRating(unwrap(await db.from('duel_ratings').select('*').eq('user_id', userId).maybeSingle()))
    },

    async saveRating(userId, { rating, games, wins, losses, draws }, expectedGames) {
      const fields = { rating, games, wins, losses, draws, updated_at: new Date().toISOString() }
      if (expectedGames === 0) {
        const inserted = await db.from('duel_ratings').insert({ user_id: userId, ...fields }).select().single()
        if (inserted.error?.code === UNIQUE_VIOLATION) return null
        return toRating(unwrap(inserted))
      }
      return toRating(unwrap(await db.from('duel_ratings').update(fields).eq('user_id', userId).eq('games', expectedGames).select().maybeSingle()))
    },

    // Demo accounts play but never rank.
    async topRatings(limit) {
      const rows = unwrap(
        await db
          .from('duel_ratings')
          .select('user_id, rating, games, wins, losses, draws, updated_at, users!inner(is_demo)')
          .eq('users.is_demo', false)
          .gt('games', 0)
          .order('rating', { ascending: false })
          .order('games', { ascending: false })
          .limit(limit),
      )
      return (rows ?? []).map(toRating)
    },
  }
}
