import { expect, it } from 'vitest'
import { randomDay } from './store-contract.js'

// Spaced review: every store must pass these. storeContract calls this inside its describe, with
// a getter for the store and the test users' ids (fresh accounts on Supabase).
export function reviewStoreContract(getStore, ids) {
  it('keeps one review item per student and concept, replacing it on save', async () => {
    const store = getStore()
    expect(await store.listReviewItems(ids.alice)).toEqual([])
    const first = await store.saveReviewItem(ids.alice, { concept: 'off-by-one', box: 1, dueDay: '2026-10-22' })
    expect(first).toMatchObject({ concept: 'off-by-one', box: 1, dueDay: '2026-10-22', lastDay: null, right: 0, wrong: 0 })
    expect(first.updatedAt).toEqual(expect.any(String))

    await store.saveReviewItem(ids.alice, { concept: 'key-error', box: 2, dueDay: '2026-10-25', lastDay: '2026-10-22', right: 1, wrong: 0 })
    const moved = await store.saveReviewItem(ids.alice, { concept: 'off-by-one', box: 1, dueDay: '2026-10-23', lastDay: '2026-10-22', right: 0, wrong: 1 })
    expect(moved).toMatchObject({ box: 1, dueDay: '2026-10-23', lastDay: '2026-10-22', wrong: 1 })
    await store.saveReviewItem(ids.bob, { concept: 'off-by-one', box: 5, dueDay: '2026-11-22' })

    const mine = await store.listReviewItems(ids.alice)
    expect(mine.map((item) => [item.concept, item.box, item.dueDay, item.right, item.wrong])).toEqual([
      ['key-error', 2, '2026-10-25', 1, 0],
      ['off-by-one', 1, '2026-10-23', 0, 1],
    ])
  })

  it("keeps one review day per student with its session, refusing a stale write, and lists days without sessions", async () => {
    const store = getStore()
    const day = randomDay()
    const session = { id: 's1', cards: [{ type: 'cause', concept: 'off-by-one', answer: 'b' }], answers: [] }
    expect(await store.getReviewDay(ids.alice, day)).toBeNull()

    const created = await store.saveReviewDay(ids.alice, day, { session, cards: 0, right: 0, completed: false }, 0)
    expect(created).toMatchObject({ day, session, cards: 0, right: 0, completed: false, version: 1 })
    // A second "first write" for the same day loses.
    expect(await store.saveReviewDay(ids.alice, day, { session, cards: 0, right: 0 }, 0)).toBeNull()

    const answered = { ...session, answers: [{ index: 0, choice: 'b', correct: true }] }
    const saved = await store.saveReviewDay(ids.alice, day, { session: answered, cards: 1, right: 1, completed: true }, 1)
    expect(saved).toMatchObject({ session: answered, cards: 1, right: 1, completed: true, version: 2 })
    expect(await store.saveReviewDay(ids.alice, day, { session, cards: 9, right: 9 }, 1)).toBeNull()
    expect(await store.getReviewDay(ids.alice, day)).toEqual(saved)
    expect(await store.getReviewDay(ids.bob, day)).toBeNull()

    const earlier = `${Number(day.slice(0, 4)) - 1}${day.slice(4)}`
    await store.saveReviewDay(ids.alice, earlier, { session: null, cards: 2, right: 0, completed: false }, 0)
    expect(await store.listReviewDays(ids.alice)).toEqual([
      { day: earlier, cards: 2, right: 0, completed: false },
      { day, cards: 1, right: 1, completed: true },
    ])
    expect(await store.listReviewDays(ids.bob)).toEqual([])
  })
}
