import { createClient } from '@supabase/supabase-js'

// Postgres "invalid input syntax for type uuid": a malformed id simply matches nothing.
const INVALID_UUID = '22P02'
// Postgres unique_violation: the email already has an account.
const UNIQUE_VIOLATION = '23505'

const toUser = (row) =>
  row && { id: row.id, email: row.email, passwordHash: row.password_hash, isDemo: row.is_demo, createdAt: row.created_at }

const toCase = (row) =>
  row && {
    id: row.id,
    userId: row.user_id,
    error: row.error,
    code: row.code,
    files: row.files ?? [],
    context: row.context ?? '',
    analysis: row.analysis,
    concept: row.concept,
    language: row.language,
    status: row.status,
    passedCount: row.passed_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

const toChallenge = (row) =>
  row && {
    id: row.id,
    caseId: row.case_id,
    puzzleId: row.puzzle_id ?? null,
    userId: row.user_id,
    brokenCode: row.broken_code,
    symptom: row.symptom,
    language: row.language,
    hints: row.hints,
    hintsRevealed: row.hints_revealed,
    status: row.status,
    attempts: row.attempts,
    passedAt: row.passed_at ?? null,
    createdAt: row.created_at,
  }

const toPuzzle = (row) =>
  row && {
    id: row.id,
    kind: row.kind,
    day: row.day,
    difficulty: row.difficulty,
    language: row.language,
    concept: row.concept,
    title: row.title,
    brokenCode: row.broken_code,
    symptom: row.symptom,
    hints: row.hints,
    createdAt: row.created_at,
  }

const toNote = (row) =>
  row && { id: row.id, userId: row.user_id, title: row.title, blocks: row.blocks, createdAt: row.created_at, updatedAt: row.updated_at }

const toProfile = (row) =>
  row && {
    handle: row.handle ?? null,
    displayName: row.display_name ?? null,
    bio: row.bio ?? '',
    avatar: row.avatar ?? null,
    featuredBadges: row.featured_badges ?? [],
    isPublic: row.is_public ?? false,
    createdAt: row.created_at,
  }
const PROFILE_COLUMNS = 'id, handle, display_name, bio, avatar, featured_badges, is_public, created_at'

// Drops undefined keys so partial updates only touch what was given.
const defined = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined))

function unwrap({ data, error }) {
  if (error?.code === INVALID_UUID) return null
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

// Production store. Uses the service role key, so it must only ever run on the server.
export function createSupabaseStore({ url, serviceKey }) {
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  return {
    async createUser({ email, passwordHash, isDemo }) {
      const result = await db
        .from('users')
        .insert({ email: email.trim().toLowerCase(), password_hash: passwordHash, is_demo: Boolean(isDemo) })
        .select()
        .single()
      if (result.error?.code === UNIQUE_VIOLATION) return null
      return toUser(unwrap(result))
    },

    async findUserByEmail(email) {
      return toUser(unwrap(await db.from('users').select('*').eq('email', email.trim().toLowerCase()).maybeSingle()))
    },

    async createCase(userId, { error, code, analysis, concept, language, files = [], context = '' }) {
      return toCase(
        unwrap(await db.from('cases').insert({ user_id: userId, error, code, files, context, analysis, concept, language }).select().single()),
      )
    },

    async listCases(userId) {
      const rows = unwrap(await db.from('cases').select('*').eq('user_id', userId).order('created_at', { ascending: false }))
      return (rows ?? []).map(toCase)
    },

    async getCase(userId, id) {
      return toCase(unwrap(await db.from('cases').select('*').eq('id', id).eq('user_id', userId).maybeSingle()))
    },

    async updateCase(userId, id, { status, passedCount }) {
      const patch = defined({ status, passed_count: passedCount, updated_at: new Date().toISOString() })
      return toCase(unwrap(await db.from('cases').update(patch).eq('id', id).eq('user_id', userId).select().maybeSingle()))
    },

    // A gym challenge has a caseId; a daily or global one has a puzzleId instead, and only one per user
    // per puzzle (null when it already exists).
    async createChallenge(userId, { caseId = null, puzzleId = null, brokenCode, symptom, language, hints }, { solution, bugExplanation }) {
      const inserted = await db
        .from('challenges')
        .insert({ case_id: caseId, puzzle_id: puzzleId, user_id: userId, broken_code: brokenCode, symptom, language, hints })
        .select()
        .single()
      if (inserted.error?.code === UNIQUE_VIOLATION) return null
      const row = unwrap(inserted)
      const secret = await db.from('challenge_secrets').insert({ challenge_id: row.id, solution, bug_explanation: bugExplanation })
      if (secret.error) {
        // Without its secret the challenge could never be judged; don't leave it behind to be resumed.
        await db.from('challenges').delete().eq('id', row.id)
        unwrap(secret)
      }
      return toChallenge(row)
    },

    async getChallenge(userId, id) {
      return toChallenge(unwrap(await db.from('challenges').select('*').eq('id', id).eq('user_id', userId).maybeSingle()))
    },

    async findOpenChallenge(userId, caseId) {
      const row = unwrap(
        await db
          .from('challenges')
          .select('*')
          .eq('user_id', userId)
          .eq('case_id', caseId)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      )
      return toChallenge(row)
    },

    async updateChallenge(userId, id, { hintsRevealed, status, attempts }) {
      const patch = defined({ hints_revealed: hintsRevealed, status, attempts })
      const row = unwrap(await db.from('challenges').update(patch).eq('id', id).eq('user_id', userId).select().maybeSingle())
      // The first pass is the one the leaderboard times.
      if (!row || status !== 'passed' || row.passed_at) return toChallenge(row)
      const stamped = await db.from('challenges').update({ passed_at: new Date().toISOString() }).eq('id', id).is('passed_at', null).select().maybeSingle()
      return toChallenge(unwrap(stamped) ?? row)
    },

    async listChallenges(userId) {
      const rows = unwrap(await db.from('challenges').select('*').eq('user_id', userId).order('created_at', { ascending: true }))
      return (rows ?? []).map(toChallenge)
    },

    async getChallengeSecret(challengeId) {
      const row = unwrap(await db.from('challenge_secrets').select('*').eq('challenge_id', challengeId).maybeSingle())
      return row && { solution: row.solution, bugExplanation: row.bug_explanation }
    },

    // One puzzle per slot (kind, day, difficulty): null when the slot is already taken.
    async createPuzzle({ kind, day, difficulty, language, concept, title, brokenCode, symptom, hints }, { solution, bugExplanation }) {
      const inserted = await db
        .from('puzzles')
        .insert({ kind, day, difficulty, language, concept, title, broken_code: brokenCode, symptom, hints })
        .select()
        .single()
      if (inserted.error?.code === UNIQUE_VIOLATION) return null
      const row = unwrap(inserted)
      const secret = await db.from('puzzle_secrets').insert({ puzzle_id: row.id, solution, bug_explanation: bugExplanation })
      if (secret.error) {
        // A puzzle nobody can be judged on must not take the slot.
        await db.from('puzzles').delete().eq('id', row.id)
        unwrap(secret)
      }
      return toPuzzle(row)
    },

    // Every filter is optional: kind, day (exact), since (that day or later), ids.
    async listPuzzles({ kind, day, since, ids } = {}) {
      if (ids?.length === 0) return []
      let query = db.from('puzzles').select('*')
      if (kind !== undefined) query = query.eq('kind', kind)
      if (day !== undefined) query = query.eq('day', day)
      if (since !== undefined) query = query.gte('day', since)
      if (ids !== undefined) query = query.in('id', ids)
      const rows = unwrap(await query.order('day', { ascending: true }))
      return (rows ?? []).map(toPuzzle)
    },

    async getPuzzle(id) {
      return toPuzzle(unwrap(await db.from('puzzles').select('*').eq('id', id).maybeSingle()))
    },

    async getPuzzleSecret(puzzleId) {
      const row = unwrap(await db.from('puzzle_secrets').select('*').eq('puzzle_id', puzzleId).maybeSingle())
      return row && { solution: row.solution, bugExplanation: row.bug_explanation }
    },

    async findPuzzleChallenge(userId, puzzleId) {
      return toChallenge(unwrap(await db.from('challenges').select('*').eq('user_id', userId).eq('puzzle_id', puzzleId).maybeSingle()))
    },

    // Who passed a puzzle: [{ userId, attempts, startedAt, passedAt }], first pass first.
    async puzzleSolves(puzzleId) {
      const rows = unwrap(
        await db
          .from('challenges')
          .select('user_id, attempts, created_at, passed_at')
          .eq('puzzle_id', puzzleId)
          .eq('status', 'passed')
          .order('passed_at', { ascending: true }),
      )
      return (rows ?? []).map((row) => ({ userId: row.user_id, attempts: row.attempts, startedAt: row.created_at, passedAt: row.passed_at }))
    },

    async createNote(userId, { title, blocks }) {
      return toNote(unwrap(await db.from('notes').insert({ user_id: userId, title, blocks }).select().single()))
    },

    async listNotes(userId) {
      const rows = unwrap(await db.from('notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false }))
      return (rows ?? []).map(toNote)
    },

    async getNote(userId, id) {
      return toNote(unwrap(await db.from('notes').select('*').eq('id', id).eq('user_id', userId).maybeSingle()))
    },

    async updateNote(userId, id, { title, blocks }) {
      const patch = defined({ title, blocks, updated_at: new Date().toISOString() })
      return toNote(unwrap(await db.from('notes').update(patch).eq('id', id).eq('user_id', userId).select().maybeSingle()))
    },

    async deleteNote(userId, id) {
      const rows = unwrap(await db.from('notes').delete().eq('id', id).eq('user_id', userId).select('id'))
      return (rows ?? []).length > 0
    },

    async addStudyTime(userId, day, seconds, maxPerDay) {
      return unwrap(await db.rpc('add_study_time', { p_user: userId, p_day: day, p_seconds: seconds, p_max: maxPerDay }))
    },

    async listStudyTime(userId) {
      const rows = unwrap(await db.from('study_time').select('day, seconds').eq('user_id', userId).order('day', { ascending: true }))
      return rows ?? []
    },

    async getProfile(userId) {
      return toProfile(unwrap(await db.from('users').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle()))
    },

    // { profile }, { conflict: 'handle' } when another account has that handle, or null for no such user.
    async updateProfile(userId, { handle, displayName, bio, avatar, featuredBadges, isPublic }) {
      const patch = defined({
        handle: typeof handle === 'string' ? handle.toLowerCase() : handle,
        display_name: displayName,
        bio,
        avatar,
        featured_badges: featuredBadges,
        is_public: isPublic,
      })
      const result = await db.from('users').update(patch).eq('id', userId).select(PROFILE_COLUMNS).maybeSingle()
      // Emails never change here, so the only unique column this update can hit is the handle.
      if (result.error?.code === UNIQUE_VIOLATION) return { conflict: 'handle' }
      const row = unwrap(result)
      return row ? { profile: toProfile(row) } : null
    },

    async findPublicProfile(handle) {
      const row = unwrap(
        await db.from('users').select(PROFILE_COLUMNS).eq('handle', handle.toLowerCase()).eq('is_public', true).maybeSingle(),
      )
      return row ? { userId: row.id, profile: toProfile(row) } : null
    },

    async countUsage(key, day) {
      const row = unwrap(await db.from('usage').select('calls').eq('key', key).eq('day', day).maybeSingle())
      return row?.calls ?? 0
    },

    async addUsage(key, day) {
      return unwrap(await db.rpc('increment_usage', { p_key: key, p_day: day }))
    },
  }
}
