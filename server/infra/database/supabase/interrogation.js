// Postgres "invalid input syntax for type uuid": a malformed id simply matches nothing.
const INVALID_UUID = '22P02'
// Postgres foreign_key_violation: no such case (or user).
const FOREIGN_KEY = '23503'
// Postgres unique_violation: the row was created by another request in between.
const UNIQUE_VIOLATION = '23505'

const toInterrogation = (row) =>
  row && {
    userId: row.user_id,
    caseId: row.case_id,
    step: row.step,
    turns: row.turns ?? [],
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

function unwrap({ data, error }) {
  if (error?.code === INVALID_UUID) return null
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

// Interrogations (guided debugging, one per user and case) on Supabase. Spread into createSupabaseStore.
export function createSupabaseInterrogations(db) {
  return {
    async getInterrogation(userId, caseId) {
      return toInterrogation(unwrap(await db.from('interrogations').select('*').eq('user_id', userId).eq('case_id', caseId).maybeSingle()))
    },

    // turn_count is the check: the write lands only if the record still had expectedTurns answers.
    async saveInterrogation(userId, caseId, { step, turns, completedAt = null }, expectedTurns) {
      const fields = { step, turns, turn_count: turns.length, completed_at: completedAt, updated_at: new Date().toISOString() }
      if (expectedTurns === 0) {
        const inserted = await db
          .from('interrogations')
          .insert({ user_id: userId, case_id: caseId, ...fields })
          .select()
          .single()
        if (inserted.error?.code === UNIQUE_VIOLATION || inserted.error?.code === FOREIGN_KEY) return null
        return toInterrogation(unwrap(inserted))
      }
      return toInterrogation(
        unwrap(
          await db
            .from('interrogations')
            .update(fields)
            .eq('user_id', userId)
            .eq('case_id', caseId)
            .eq('turn_count', expectedTurns)
            .select()
            .maybeSingle(),
        ),
      )
    },

    async listInterrogations(userId) {
      const rows = unwrap(await db.from('interrogations').select('*').eq('user_id', userId).order('updated_at', { ascending: false }))
      return (rows ?? []).map(toInterrogation)
    },
  }
}
