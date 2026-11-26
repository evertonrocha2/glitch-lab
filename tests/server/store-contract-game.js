import { expect, it } from 'vitest'

// Glitch World v2 heroes: every store must pass these. One document per player, saved under a version check.
export function gameStoreContract(getStore, ids) {
  const heroData = (gold) => ({ gold, bag: ['sword'] })

  it('has no game hero for a new player', async () => {
    expect(await getStore().getGameHero(ids.alice)).toBeNull()
  })

  it('saves under an optimistic version and refuses stale saves, without touching anyone else', async () => {
    const store = getStore()
    const first = await store.saveGameHero(ids.alice, heroData(1), 0)
    expect(first).toMatchObject({ version: 1, data: heroData(1) })
    expect(typeof first.updatedAt).toBe('string')
    expect(await store.saveGameHero(ids.alice, heroData(99), 0)).toBeNull()
    const second = await store.saveGameHero(ids.alice, heroData(2), 1)
    expect(second).toMatchObject({ version: 2, data: heroData(2) })
    expect(await store.saveGameHero(ids.alice, heroData(50), 1)).toBeNull()
    expect(await store.getGameHero(ids.alice)).toEqual(second)
    expect(await store.getGameHero(ids.bob)).toBeNull()
  })

  it('lets only one of two concurrent saves with the same version win', async () => {
    const store = getStore()
    await store.saveGameHero(ids.alice, heroData(1), 0)
    const results = await Promise.all([store.saveGameHero(ids.alice, heroData(2), 1), store.saveGameHero(ids.alice, heroData(3), 1)])
    expect(results.filter((hero) => hero !== null)).toHaveLength(1)
    expect((await store.getGameHero(ids.alice)).version).toBe(2)
  })

  it('returns copies, not the stored document', async () => {
    const store = getStore()
    const input = heroData(1)
    const saved = await store.saveGameHero(ids.alice, input, 0)
    input.gold = 777
    saved.data.bag.push('x')
    const read = await store.getGameHero(ids.alice)
    expect(read.data).toEqual(heroData(1))
    read.data.gold = 5
    expect((await store.getGameHero(ids.alice)).data).toEqual(heroData(1))
  })
}
