// Postgres unique_violation: the day (or my run of that day) already exists.
const UNIQUE_VIOLATION = '23505'

const toDay = (row) => row && { day: row.day, snippets: row.snippets ?? [], source: row.source, createdAt: row.created_at }

const toRun = (row) =>
  row && {
    userId: row.user_id,
    day: row.day,
    rounds: row.rounds ?? [],
    score: row.score,
    correct: row.correct,
    ms: row.ms,
    finishedAt: row.finished_at ?? null,
    version: row.version,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
  }

function unwrap({ data, error }) {
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

// Line hunt on Supabase (tables hunt_days and hunt_runs). Spread into createSupabaseStore.
export function createSupabaseHunt(db) {
  return {
    async createHuntDay({ day, snippets, source = 'pool' }) {
      const inserted = await db.from('hunt_days').insert({ day, snippets, source }).select().single()
      if (inserted.error?.code === UNIQUE_VIOLATION) return null
      return toDay(unwrap(inserted))
    },

    async getHuntDay(day) {
      return toDay(unwrap(await db.from('hunt_days').select('*').eq('day', day).maybeSingle()))
    },

    async getHuntRun(userId, day) {
      return toRun(unwrap(await db.from('hunt_runs').select('*').eq('user_id', userId).eq('day', day).maybeSingle()))
    },

    async createHuntRun(userId, { day, rounds }) {
      const inserted = await db.from('hunt_runs').insert({ user_id: userId, day, rounds }).select().single()
      if (inserted.error?.code === UNIQUE_VIOLATION) return null
      return toRun(unwrap(inserted))
    },

    // version is the check: the write lands only if nothing else saved since the run was read.
    async saveHuntRun(userId, day, { rounds, score, correct, ms, finishedAt }, expectedVersion) {
      const patch = { rounds, score, correct, ms, finished_at: finishedAt ?? null, version: expectedVersion + 1, updated_at: new Date().toISOString() }
      return toRun(
        unwrap(await db.from('hunt_runs').update(patch).eq('user_id', userId).eq('day', day).eq('version', expectedVersion).select().maybeSingle()),
      )
    },

    async listHuntRuns(userId) {
      const rows = unwrap(await db.from('hunt_runs').select('*').eq('user_id', userId).order('day', { ascending: true }))
      return (rows ?? []).map(toRun)
    },

    // Demo accounts play but never rank.
    async huntDayRuns(day) {
      const rows = unwrap(
        await db
          .from('hunt_runs')
          .select('user_id, score, correct, ms, finished_at, users!inner(is_demo)')
          .eq('day', day)
          .eq('users.is_demo', false)
          .not('finished_at', 'is', null),
      )
      return (rows ?? []).map((row) => ({ userId: row.user_id, score: row.score, correct: row.correct, ms: row.ms, finishedAt: row.finished_at }))
    },
  }
}
