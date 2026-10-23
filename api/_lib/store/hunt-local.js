const now = () => new Date().toISOString()
const copy = (value) => (value == null ? null : structuredClone(value))

// Line hunt in the local JSON file: one set of snippets per day (answers included, for the server
// only) and one run per player and day. Spread into createLocalStore.
export function createLocalHunt({ load, save }) {
  // Files saved before the line hunt existed don't have these lists yet.
  const daysOf = (data) => (data.huntDays ??= [])
  const runsOf = (data) => (data.huntRuns ??= [])
  const ownRun = (data, userId, day) => runsOf(data).find((item) => item.userId === userId && item.day === day)

  return {
    // One set per day: null when that day is already written.
    async createHuntDay({ day, snippets, source = 'pool' }) {
      const data = await load()
      if (daysOf(data).some((item) => item.day === day)) return null
      const created = { day, snippets, source, createdAt: now() }
      daysOf(data).push(structuredClone(created))
      await save()
      return copy(created)
    },

    async getHuntDay(day) {
      return copy(daysOf(await load()).find((item) => item.day === day))
    },

    async getHuntRun(userId, day) {
      return copy(ownRun(await load(), userId, day))
    },

    // One run per player and day: null when I already have one.
    async createHuntRun(userId, { day, rounds }) {
      const data = await load()
      if (ownRun(data, userId, day)) return null
      const stamp = now()
      const created = { userId, day, rounds, score: 0, correct: 0, ms: 0, finishedAt: null, version: 0, startedAt: stamp, updatedAt: stamp }
      runsOf(data).push(structuredClone(created))
      await save()
      return copy(created)
    },

    // Writes only when the run is still at expectedVersion, so two answers landing together never
    // overwrite each other. null otherwise.
    async saveHuntRun(userId, day, { rounds, score, correct, ms, finishedAt }, expectedVersion) {
      const found = ownRun(await load(), userId, day)
      if (!found || found.version !== expectedVersion) return null
      Object.assign(found, { rounds: structuredClone(rounds), score, correct, ms, finishedAt: finishedAt ?? null })
      found.version += 1
      found.updatedAt = now()
      await save()
      return copy(found)
    },

    // Oldest day first.
    async listHuntRuns(userId) {
      const runs = runsOf(await load()).filter((item) => item.userId === userId)
      return copy(runs.sort((a, b) => a.day.localeCompare(b.day)))
    },

    // A day's finished runs for the leaderboard: [{ userId, score, correct, ms, finishedAt }].
    // Demo accounts play but never rank.
    async huntDayRuns(day) {
      const data = await load()
      const demos = new Set((data.users ?? []).filter((user) => user.isDemo).map((user) => user.id))
      return runsOf(data)
        .filter((item) => item.day === day && item.finishedAt && !demos.has(item.userId))
        .map(({ userId, score, correct, ms, finishedAt }) => ({ userId, score, correct, ms, finishedAt }))
    },
  }
}
