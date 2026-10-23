import { randomUUID } from 'node:crypto'

const now = () => new Date().toISOString()
const copy = (value) => (value == null ? null : structuredClone(value))

// What a duel list shows: no rounds (they hold the answers), no answers or focus events.
const summary = ({ id, code, kind, status, players, startAt, finishedAt, result, rematchOf, rematchId, createdAt, updatedAt }) =>
  copy({ id, code, kind, status, players, startAt, finishedAt, result, rematchOf, rematchId, createdAt, updatedAt })

const FIELDS = ['status', 'players', 'startAt', 'finishedAt', 'answers', 'focus', 'result', 'rematchId']

// Duels and duel ratings in the local JSON file. Spread into createLocalStore.
export function createLocalDuels({ load, save }) {
  // Files saved before duels existed don't have these lists yet.
  const duelsOf = (data) => (data.duels ??= [])
  const ratingsOf = (data) => (data.duelRatings ??= {})
  const hasPlayer = (duel, userId) => duel.players.some((player) => player.userId === userId)
  // Newest first; for the same moment, the one made last.
  const newestFirst = (list) => [...list].reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    // null when the code is taken. The rounds (with their answers) and the bot's plan stay on the server.
    async createDuel({ code, kind, status, players, rounds, botPlan = null, startAt = null, rematchOf = null }) {
      const data = await load()
      const duels = duelsOf(data)
      if (duels.some((item) => item.code === code)) return null
      const stamp = now()
      const created = {
        id: randomUUID(),
        code,
        kind,
        status,
        players,
        startAt,
        finishedAt: null,
        rounds,
        botPlan,
        answers: [],
        focus: [],
        result: null,
        rematchOf,
        rematchId: null,
        version: 0,
        createdAt: stamp,
        updatedAt: stamp,
      }
      duels.push(structuredClone(created))
      await save()
      return created
    },

    async getDuel(id) {
      return copy(duelsOf(await load()).find((item) => item.id === id))
    },

    async findDuelByCode(code) {
      return copy(duelsOf(await load()).find((item) => item.code === code))
    },

    // Writes only when the duel is still at expectedVersion (nothing else saved since it was read),
    // so two answers landing together never overwrite each other. null otherwise.
    async updateDuel(id, fields, expectedVersion) {
      const found = duelsOf(await load()).find((item) => item.id === id)
      if (!found || found.version !== expectedVersion) return null
      for (const field of FIELDS) if (fields[field] !== undefined) found[field] = structuredClone(fields[field])
      found.version += 1
      found.updatedAt = now()
      await save()
      return copy(found)
    },

    // Newest first, as summaries. Filters: status, limit.
    async listDuels(userId, { status, limit } = {}) {
      const mine = duelsOf(await load()).filter((item) => hasPlayer(item, userId) && (status === undefined || item.status === status))
      return newestFirst(mine).slice(0, limit ?? undefined).map(summary)
    },

    // Quick-match duels still waiting, made by someone else and touched since `since`. Oldest first.
    async findQueueDuels(userId, since, limit = 5) {
      const open = duelsOf(await load()).filter(
        (item) => item.kind === 'queue' && item.status === 'waiting' && item.updatedAt >= since && !hasPlayer(item, userId),
      )
      return copy(open.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, limit))
    },

    async getRating(userId) {
      return copy(ratingsOf(await load())[userId])
    },

    // games is the version check: the write lands only if the player still had expectedGames games.
    async saveRating(userId, { rating, games, wins, losses, draws }, expectedGames) {
      const ratings = ratingsOf(await load())
      if ((ratings[userId]?.games ?? 0) !== expectedGames) return null
      ratings[userId] = { userId, rating, games, wins, losses, draws, updatedAt: now() }
      await save()
      return copy(ratings[userId])
    },

    // Highest first, without demo accounts (they play, but never rank).
    async topRatings(limit) {
      const data = await load()
      const demos = new Set((data.users ?? []).filter((user) => user.isDemo).map((user) => user.id))
      const list = Object.values(ratingsOf(data)).filter((item) => !demos.has(item.userId) && item.games > 0)
      return copy(list.sort((a, b) => b.rating - a.rating || b.games - a.games).slice(0, limit))
    },
  }
}
