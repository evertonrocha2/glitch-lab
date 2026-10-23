const now = () => new Date().toISOString()
const copy = (value) => (value == null ? null : structuredClone(value))

// Interrogations (guided debugging, one per user and case) in the local JSON file. Spread into
// createLocalStore.
export function createLocalInterrogations({ load, save }) {
  // Files saved before interrogations existed don't have the list yet.
  const listOf = (data) => (data.interrogations ??= [])
  const own = (data, userId, caseId) => listOf(data).find((item) => item.userId === userId && item.caseId === caseId)

  return {
    async getInterrogation(userId, caseId) {
      return copy(own(await load(), userId, caseId))
    },

    // expectedTurns is how many answers the record had when it was read: if another request saved
    // in between, nothing is written and the answer is null.
    async saveInterrogation(userId, caseId, { step, turns, completedAt = null }, expectedTurns) {
      const data = await load()
      const found = own(data, userId, caseId)
      if ((found?.turns.length ?? 0) !== expectedTurns) return null
      const stamp = now()
      const record = found ?? { userId, caseId, createdAt: stamp }
      record.step = step
      record.turns = structuredClone(turns)
      record.completedAt = completedAt
      record.updatedAt = stamp
      if (!found) listOf(data).push(record)
      await save()
      return copy(record)
    },

    // Most recently answered first.
    async listInterrogations(userId) {
      const mine = listOf(await load()).filter((item) => item.userId === userId)
      return copy([...mine].reverse().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    },
  }
}
