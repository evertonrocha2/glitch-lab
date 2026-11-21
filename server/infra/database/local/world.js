// Where each player left their Glitch World hero, in the local JSON file. Spread into createLocalStore.
export function createLocalWorld({ load, save }) {
  // Files saved before Glitch World existed don't have the map yet.
  const positionsOf = (data) => (data.worldPositions ??= {})

  return {
    async getWorldPosition(userId) {
      const found = positionsOf(await load())[userId]
      return found ? { ...found } : null
    },

    async saveWorldPosition(userId, { world, x, y }) {
      const data = await load()
      const saved = { world, x, y, updatedAt: new Date().toISOString() }
      positionsOf(data)[userId] = saved
      await save()
      return { ...saved }
    },
  }
}
