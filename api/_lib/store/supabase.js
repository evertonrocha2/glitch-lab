import { createClient } from '@supabase/supabase-js'

// Postgres "invalid input syntax for type uuid": a malformed id simply matches nothing.
const INVALID_UUID = '22P02'

const toCase = (row) =>
  row && {
    id: row.id,
    userId: row.user_id,
    error: row.error,
    code: row.code,
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
    userId: row.user_id,
    brokenCode: row.broken_code,
    symptom: row.symptom,
    language: row.language,
    hints: row.hints,
    hintsRevealed: row.hints_revealed,
    status: row.status,
    attempts: row.attempts,
    createdAt: row.created_at,
  }

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
    async createCase(userId, { error, code, analysis, concept, language }) {
      return toCase(unwrap(await db.from('cases').insert({ user_id: userId, error, code, analysis, concept, language }).select().single()))
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

    async createChallenge(userId, { caseId, brokenCode, symptom, language, hints }, { solution, bugExplanation }) {
      const row = unwrap(
        await db
          .from('challenges')
          .insert({ case_id: caseId, user_id: userId, broken_code: brokenCode, symptom, language, hints })
          .select()
          .single(),
      )
      unwrap(await db.from('challenge_secrets').insert({ challenge_id: row.id, solution, bug_explanation: bugExplanation }))
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
      return toChallenge(unwrap(await db.from('challenges').update(patch).eq('id', id).eq('user_id', userId).select().maybeSingle()))
    },

    async getChallengeSecret(challengeId) {
      const row = unwrap(await db.from('challenge_secrets').select('*').eq('challenge_id', challengeId).maybeSingle())
      return row && { solution: row.solution, bugExplanation: row.bug_explanation }
    },

    async countUsage(key, day) {
      const row = unwrap(await db.from('usage').select('count').eq('key', key).eq('day', day).maybeSingle())
      return row?.count ?? 0
    },

    async addUsage(key, day) {
      return unwrap(await db.rpc('increment_usage', { p_key: key, p_day: day }))
    },
  }
}
