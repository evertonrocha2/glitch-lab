// Postgres unique_violation: the day's row was made by another request in between.
const UNIQUE_VIOLATION = '23505'

const toItem = (row) =>
  row && {
    concept: row.concept,
    box: row.box,
    dueDay: row.due_day,
    lastDay: row.last_day ?? null,
    right: row.right_count,
    wrong: row.wrong_count,
    updatedAt: row.updated_at,
  }

const toDaySummary = (row) => row && { day: row.day, cards: row.cards, right: row.right_count, completed: row.completed }

const toDay = (row) => row && { ...toDaySummary(row), session: row.session ?? null, version: row.version, updatedAt: row.updated_at }

function unwrap({ data, error }) {
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

// Spaced review on Supabase (review_items, review_days). Spread into createSupabaseStore.
export function createSupabaseReview(db) {
  return {
    async listReviewItems(userId) {
      const rows = unwrap(await db.from('review_items').select('*').eq('user_id', userId).order('concept', { ascending: true }))
      return (rows ?? []).map(toItem)
    },

    async saveReviewItem(userId, { concept, box, dueDay, lastDay = null, right = 0, wrong = 0 }) {
      const row = { user_id: userId, concept, box, due_day: dueDay, last_day: lastDay, right_count: right, wrong_count: wrong, updated_at: new Date().toISOString() }
      return toItem(unwrap(await db.from('review_items').upsert(row, { onConflict: 'user_id,concept' }).select().single()))
    },

    async getReviewDay(userId, day) {
      return toDay(unwrap(await db.from('review_days').select('*').eq('user_id', userId).eq('day', day).maybeSingle()))
    },

    // version is the check: the write lands only if nothing else saved since the row was read.
    async saveReviewDay(userId, day, { session = null, cards = 0, right = 0, completed = false }, expectedVersion) {
      const fields = { session, cards, right_count: right, completed: Boolean(completed), version: expectedVersion + 1, updated_at: new Date().toISOString() }
      if (expectedVersion === 0) {
        const inserted = await db.from('review_days').insert({ user_id: userId, day, ...fields }).select().single()
        if (inserted.error?.code === UNIQUE_VIOLATION) return null
        return toDay(unwrap(inserted))
      }
      return toDay(unwrap(await db.from('review_days').update(fields).eq('user_id', userId).eq('day', day).eq('version', expectedVersion).select().maybeSingle()))
    },

    async listReviewDays(userId) {
      const rows = unwrap(
        await db.from('review_days').select('day, cards, right_count, completed').eq('user_id', userId).order('day', { ascending: true }),
      )
      return (rows ?? []).map(toDaySummary)
    },
  }
}
