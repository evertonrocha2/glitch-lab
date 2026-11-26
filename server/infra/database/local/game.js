// Glitch World v2 heroes in the local JSON file: one document per player, saved under a version check.
// Spread into createLocalStore.
export function createLocalGame({ load, save }) {
  // Files saved before Glitch World v2 existed don't have the map yet.
  const heroesOf = (data) => (data.gameHeroes ??= {})
  const toHero = (row) => ({ version: row.version, data: structuredClone(row.data), updatedAt: row.updatedAt })

  return {
    async getGameHero(userId) {
      const found = heroesOf(await load())[userId]
      return found ? toHero(found) : null
    },

    // The version check and the write happen with no await in between, so two saves
    // with the same expectedVersion can't both win.
    async saveGameHero(userId, hero, expectedVersion) {
      const heroes = heroesOf(await load())
      const stored = heroes[userId]
      if ((stored?.version ?? 0) !== expectedVersion) return null
      const row = { version: expectedVersion + 1, data: structuredClone(hero), updatedAt: new Date().toISOString() }
      heroes[userId] = row
      await save()
      return toHero(row)
    },
  }
}
