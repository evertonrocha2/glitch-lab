const now = () => new Date().toISOString()
const copy = (value) => (value == null ? null : structuredClone(value))

const toItem = ({ concept, box, dueDay, lastDay, right, wrong, updatedAt }) => ({ concept, box, dueDay, lastDay, right, wrong, updatedAt })
// A list of days leaves the session out (it holds the answers).
const toDaySummary = ({ day, cards, right, completed }) => ({ day, cards, right, completed })
const toDay = (row) => copy({ ...toDaySummary(row), session: row.session ?? null, version: row.version, updatedAt: row.updatedAt })

// Spaced review in the local JSON file: one item per student and concept (its Leitner box), and
// one row per student and day (that day's session and tally). Spread into createLocalStore.
export function createLocalReview({ load, save }) {
  // Files saved before reviews existed don't have these lists yet.
  const itemsOf = (data) => (data.reviewItems ??= [])
  const daysOf = (data) => (data.reviewDays ??= [])

  return {
    // Mine, by concept.
    async listReviewItems(userId) {
      const mine = itemsOf(await load()).filter((item) => item.userId === userId)
      return mine.map(toItem).sort((a, b) => a.concept.localeCompare(b.concept))
    },

    // Creates or replaces my item for a concept.
    async saveReviewItem(userId, { concept, box, dueDay, lastDay = null, right = 0, wrong = 0 }) {
      const items = itemsOf(await load())
      let found = items.find((item) => item.userId === userId && item.concept === concept)
      if (!found) {
        found = { userId, concept }
        items.push(found)
      }
      Object.assign(found, { box, dueDay, lastDay, right, wrong, updatedAt: now() })
      await save()
      return toItem(found)
    },

    // { day, session, cards, right, completed, version, updatedAt } or null.
    async getReviewDay(userId, day) {
      const found = daysOf(await load()).find((item) => item.userId === userId && item.day === day)
      return found ? toDay(found) : null
    },

    // Writes only when the row is still at expectedVersion (0: no row yet), so two answers landing
    // together never overwrite each other. null otherwise.
    async saveReviewDay(userId, day, { session = null, cards = 0, right = 0, completed = false }, expectedVersion) {
      const days = daysOf(await load())
      const found = days.find((item) => item.userId === userId && item.day === day)
      if ((found?.version ?? 0) !== expectedVersion) return null
      const row = found ?? { userId, day, version: 0 }
      Object.assign(row, { session: structuredClone(session), cards, right, completed: Boolean(completed), version: row.version + 1, updatedAt: now() })
      if (!found) days.push(row)
      await save()
      return toDay(row)
    },

    // Oldest first, without sessions.
    async listReviewDays(userId) {
      const mine = daysOf(await load()).filter((item) => item.userId === userId)
      return mine.map(toDaySummary).sort((a, b) => a.day.localeCompare(b.day))
    },
  }
}
