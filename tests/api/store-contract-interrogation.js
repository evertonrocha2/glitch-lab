import { expect, it } from 'vitest'

// Interrogations: every store must pass these. storeContract calls this inside its describe, with
// a getter for the store and its test users.
const CASE = {
  error: 'TypeError: x is undefined',
  code: 'x.y',
  analysis: { explicacao: 'a', causa: 'b', correcao: 'c', exercicio: { enunciado: 'd', resposta: 'e' } },
  concept: 'undefined-access',
  language: 'javascript',
}

const turn = (step, passed, answer = 'my answer') => ({ step, answer, feedback: 'ok', question: passed ? '' : 'why?', passed, at: new Date().toISOString() })

export function interrogationStoreContract(getStore, ids) {
  it('keeps one interrogation per user and case, refusing a stale write', async () => {
    const store = getStore()
    const kase = await store.createCase(ids.alice, CASE)
    expect(await store.getInterrogation(ids.alice, kase.id)).toBeNull()

    const first = await store.saveInterrogation(ids.alice, kase.id, { step: 0, turns: [turn('reproduce', false)] }, 0)
    expect(first).toMatchObject({ userId: ids.alice, caseId: kase.id, step: 0, completedAt: null })
    expect(first.turns).toHaveLength(1)
    expect(first.createdAt).toEqual(expect.any(String))

    // Another answer already landed: a write made from the old read is refused.
    expect(await store.saveInterrogation(ids.alice, kase.id, { step: 1, turns: [turn('reproduce', true)] }, 0)).toBeNull()
    const second = await store.saveInterrogation(ids.alice, kase.id, { step: 1, turns: [...first.turns, turn('reproduce', true)] }, 1)
    expect(second).toMatchObject({ step: 1 })
    expect(second.turns.map((item) => item.passed)).toEqual([false, true])
    expect(await store.getInterrogation(ids.alice, kase.id)).toEqual(second)

    // Someone else's read finds nothing.
    expect(await store.getInterrogation(ids.bob, kase.id)).toBeNull()
  })

  it('saves a finished interrogation and lists mine, newest first', async () => {
    const store = getStore()
    const older = await store.createCase(ids.alice, CASE)
    const newer = await store.createCase(ids.alice, CASE)
    const steps = ['reproduce', 'read', 'hypothesis', 'isolate', 'fix', 'prevent']
    const doneAt = new Date().toISOString()
    await store.saveInterrogation(ids.alice, older.id, { step: 1, turns: [turn('reproduce', true)] }, 0)
    const done = await store.saveInterrogation(ids.alice, newer.id, { step: 6, turns: steps.map((step) => turn(step, true)), completedAt: doneAt }, 0)
    expect(done).toMatchObject({ step: 6, completedAt: expect.any(String) })
    expect(Date.parse(done.completedAt)).toBe(Date.parse(doneAt))

    const mine = await store.listInterrogations(ids.alice)
    const caseIds = mine.map((item) => item.caseId)
    expect(caseIds).toEqual(expect.arrayContaining([older.id, newer.id]))
    expect(caseIds.indexOf(newer.id)).toBeLessThan(caseIds.indexOf(older.id))
    expect((await store.listInterrogations(ids.bob)).map((item) => item.caseId)).not.toContain(newer.id)
  })
}
