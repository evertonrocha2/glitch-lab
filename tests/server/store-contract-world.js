import { expect, it } from 'vitest'

// Glitch World positions: every store must pass these. storeContract calls this inside its describe,
// with a getter for the store and the test users' ids (fresh accounts on Supabase).
export function worldStoreContract(getStore, ids) {
  it('has no world position for a new player', async () => {
    expect(await getStore().getWorldPosition(ids.alice)).toBeNull()
  })

  it("saves one world position per player and replaces it, without touching anyone else's", async () => {
    const store = getStore()
    const first = await store.saveWorldPosition(ids.alice, { world: 'laboratorio', x: 3, y: 4 })
    expect(first).toMatchObject({ world: 'laboratorio', x: 3, y: 4 })
    expect(typeof first.updatedAt).toBe('string')
    const saved = await store.saveWorldPosition(ids.alice, { world: 'floresta-js', x: 5, y: 6 })
    expect(saved).toMatchObject({ world: 'floresta-js', x: 5, y: 6 })
    expect(await store.getWorldPosition(ids.alice)).toEqual(saved)
    expect(await store.getWorldPosition(ids.bob)).toBeNull()
  })
}
