import { createClient } from '@supabase/supabase-js'
import { PROFILE_COLUMNS as SHARED_PROFILE_COLUMNS, profileFromRow } from './profileShape.js'
import { createSupabaseCommunity } from './community-supabase.js'
import { createSupabaseDuels } from './duel-supabase.js'
import { createSupabaseEvents } from './events-supabase.js'

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

const toRiddle = (row) =>
  row && { id: row.id, day: row.day, mode: row.mode, answer: row.answer, payload: row.payload ?? {}, source: row.source, createdAt: row.created_at }

const toRiddleResult = (row) =>
  row && {
    userId: row.user_id,
    day: row.day,
    mode: row.mode,
    guesses: row.guesses ?? [],
    solved: row.solved,
    solvedAt: row.solved_at ?? null,
    updatedAt: row.updated_at,
  }

const toNote = (row) =>
  row && {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    blocks: row.blocks,
    isPublic: row.is_public ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

const toTrail = (row) =>
  row && {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    summary: row.summary,
    missions: row.missions ?? [],
    done: row.done ?? [],
    createdAt: row.created_at,
  }

const toProfile = profileFromRow
const PROFILE_COLUMNS = SHARED_PROFILE_COLUMNS

// ilike treats % and _ as wildcards (and PostgREST reads * as %): escape them so a search is plain text.
const likePattern = (query) => `%${query.replace(/[\\%_*]/g, (char) => `\\${char}`)}%`

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
      const mine = () => db.from('challenges').update(patch).eq('id', id).eq('user_id', userId)
      // The first pass is the one the leaderboard times: stamped in the same write as the status.
      if (status === 'passed') {
        const stamped = unwrap(await mine().update({ ...patch, passed_at: new Date().toISOString() }).is('passed_at', null).select().maybeSingle())
        if (stamped) return toChallenge(stamped)
      }
      return toChallenge(unwrap(await mine().select().maybeSingle()))
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
          .select('user_id, attempts, created_at, passed_at, users!inner(is_demo)')
          .eq('puzzle_id', puzzleId)
          .eq('status', 'passed')
          // Demo accounts are free and unlimited: they play, but never rank.
          .eq('users.is_demo', false)
          .not('passed_at', 'is', null)
          .order('passed_at', { ascending: true }),
      )
      return (rows ?? []).map((row) => ({ userId: row.user_id, attempts: row.attempts, startedAt: row.created_at, passedAt: row.passed_at }))
    },

    // Glitchdle. One riddle per (day, mode): null when that slot is already taken.
    async createRiddle({ day, mode, answer, payload = {}, source = 'dataset' }) {
      const inserted = await db.from('riddles').insert({ day, mode, answer, payload, source }).select().single()
      if (inserted.error?.code === UNIQUE_VIOLATION) return null
      return toRiddle(unwrap(inserted))
    },

    async listRiddles({ day, since } = {}) {
      let query = db.from('riddles').select('*')
      if (day !== undefined) query = query.eq('day', day)
      if (since !== undefined) query = query.gte('day', since)
      const rows = unwrap(await query.order('day', { ascending: true }))
      return (rows ?? []).map(toRiddle)
    },

    async getRiddleResult(userId, day, mode) {
      return toRiddleResult(unwrap(await db.from('riddle_results').select('*').eq('user_id', userId).eq('day', day).eq('mode', mode).maybeSingle()))
    },

    // guess_count is the version check: the write only lands if I still had expectedCount guesses.
    async saveRiddleResult(userId, { day, mode, guesses, solved }, expectedCount) {
      const stamp = new Date().toISOString()
      const fields = { guesses, guess_count: guesses.length, solved: Boolean(solved), updated_at: stamp, ...(solved ? { solved_at: stamp } : {}) }
      if (expectedCount === 0) {
        const inserted = await db.from('riddle_results').insert({ user_id: userId, day, mode, ...fields }).select().single()
        if (inserted.error?.code === UNIQUE_VIOLATION) return null
        return toRiddleResult(unwrap(inserted))
      }
      const row = unwrap(
        await db
          .from('riddle_results')
          .update(fields)
          .eq('user_id', userId)
          .eq('day', day)
          .eq('mode', mode)
          .eq('guess_count', expectedCount)
          .select()
          .maybeSingle(),
      )
      return toRiddleResult(row)
    },

    async listRiddleResults(userId) {
      const rows = unwrap(await db.from('riddle_results').select('*').eq('user_id', userId).order('day', { ascending: true }))
      return (rows ?? []).map(toRiddleResult)
    },

    // Demo accounts play but don't count, like on the leaderboard.
    async riddleDayResults(day) {
      const rows = unwrap(
        await db.from('riddle_results').select('user_id, mode, guess_count, solved, users!inner(is_demo)').eq('day', day).eq('users.is_demo', false),
      )
      return (rows ?? []).map((row) => ({ userId: row.user_id, mode: row.mode, guessCount: row.guess_count, solved: row.solved }))
    },

    async createNote(userId, { title, blocks, isPublic = false }) {
      return toNote(unwrap(await db.from('notes').insert({ user_id: userId, title, blocks, is_public: isPublic }).select().single()))
    },

    async listNotes(userId) {
      const rows = unwrap(await db.from('notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false }))
      return (rows ?? []).map(toNote)
    },

    async getNote(userId, id) {
      return toNote(unwrap(await db.from('notes').select('*').eq('id', id).eq('user_id', userId).maybeSingle()))
    },

    async updateNote(userId, id, { title, blocks, isPublic }) {
      const patch = defined({ title, blocks, is_public: isPublic, updated_at: new Date().toISOString() })
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

    // Study trails. created_at may be given (the demo's trail starts in the past).
    async createTrail(userId, { title, summary, missions, done = [], createdAt }) {
      const row = defined({ user_id: userId, title, summary, missions, done, created_at: createdAt })
      return toTrail(unwrap(await db.from('trails').insert(row).select().single()))
    },

    async listTrails(userId) {
      const rows = unwrap(await db.from('trails').select('*').eq('user_id', userId).order('created_at', { ascending: false }))
      return (rows ?? []).map(toTrail)
    },

    async getTrail(userId, id) {
      return toTrail(unwrap(await db.from('trails').select('*').eq('id', id).eq('user_id', userId).maybeSingle()))
    },

    // Read, change, write: only the student ticks their own reflect missions, so a race is harmless.
    async setMissionDone(userId, trailId, missionId, done) {
      const trail = toTrail(unwrap(await db.from('trails').select('*').eq('id', trailId).eq('user_id', userId).maybeSingle()))
      if (!trail?.missions.some((mission) => mission.id === missionId)) return null
      const others = trail.done.filter((id) => id !== missionId)
      const next = done ? [...others, missionId] : others
      return toTrail(unwrap(await db.from('trails').update({ done: next }).eq('id', trailId).eq('user_id', userId).select().maybeSingle()))
    },

    async getProfile(userId) {
      return toProfile(unwrap(await db.from('users').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle()))
    },

    // { profile }, { conflict: 'handle' } when another account has that handle, or null for no such user.
    async updateProfile(userId, { handle, displayName, bio, avatar, featuredBadges, isPublic, role, headline, university, course, work, location, languages, links, openTo }) {
      const patch = defined({
        handle: typeof handle === 'string' ? handle.toLowerCase() : handle,
        display_name: displayName,
        bio,
        avatar,
        featured_badges: featuredBadges,
        is_public: isPublic,
        role,
        headline,
        university,
        course,
        work,
        location,
        languages,
        links,
        open_to: openTo,
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

    // Public profiles whose handle or name holds the query (any case), newest members first.
    // Two simple queries instead of one "or" filter, so the query text never needs PostgREST escaping.
    async searchPublicProfiles(query, limit) {
      const base = () =>
        db.from('users').select(PROFILE_COLUMNS).eq('is_public', true).not('handle', 'is', null).order('created_at', { ascending: false }).limit(limit)
      if (!query) return (unwrap(await base()) ?? []).map((row) => ({ userId: row.id, profile: toProfile(row) }))
      const pattern = likePattern(query)
      const [byHandle, byName] = await Promise.all([base().ilike('handle', pattern), base().ilike('display_name', pattern)])
      const rows = new Map()
      for (const row of [...(unwrap(byHandle) ?? []), ...(unwrap(byName) ?? [])]) rows.set(row.id, row)
      return [...rows.values()]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
        .map((row) => ({ userId: row.id, profile: toProfile(row) }))
    },

    async countUsage(key, day) {
      const row = unwrap(await db.from('usage').select('calls').eq('key', key).eq('day', day).maybeSingle())
      return row?.calls ?? 0
    },

    async addUsage(key, day) {
      return unwrap(await db.rpc('increment_usage', { p_key: key, p_day: day }))
    },

    // Articles, comments, reactions and notifications: see community-supabase.js.
    ...createSupabaseCommunity(db),

    // Duels and duel ratings: see duel-supabase.js.
    ...createSupabaseDuels(db),
    // Community events, entries and votes: see events-supabase.js.
    ...createSupabaseEvents(db),
  }
}
