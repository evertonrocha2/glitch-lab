import { expect, it } from 'vitest'
import { randomDay } from './store-contract.js'

// Line hunt: every store must pass these. storeContract calls this inside its describe, with a
// getter for the store and the test users' ids (fresh accounts on Supabase). Days are random far-off
// dates, since the Supabase tables outlive each test.
const SNIPPET = { id: 'js-x', language: 'javascript', concept: 'off-by-one', line: 2, code: ['a', 'b'], symptom: { en: 'x', pt: 'x' }, explanation: { en: 'y', pt: 'y' } }

export function huntStoreContract(getStore, ids) {
  it('keeps one line hunt set per day, answers included, for the server only', async () => {
    const store = getStore()
    const day = randomDay()
    expect(await store.getHuntDay(day)).toBeNull()
    const created = await store.createHuntDay({ day, snippets: [SNIPPET], source: 'ai' })
    expect(created).toMatchObject({ day, snippets: [SNIPPET], source: 'ai' })
    expect(await store.createHuntDay({ day, snippets: [], source: 'pool' })).toBeNull()
    expect(await store.getHuntDay(day)).toMatchObject({ day, snippets: [SNIPPET], source: 'ai' })
  })

  it('keeps one run per player and day, refusing a stale write', async () => {
    const store = getStore()
    const day = randomDay()
    const servedAt = new Date().toISOString()
    const run = await store.createHuntRun(ids.alice, { day, rounds: [{ servedAt }] })
    expect(run).toMatchObject({ userId: ids.alice, day, rounds: [{ servedAt }], score: 0, correct: 0, ms: 0, finishedAt: null, version: 0 })
    expect(await store.createHuntRun(ids.alice, { day, rounds: [] })).toBeNull()
    expect(await store.getHuntRun(ids.bob, day)).toBeNull()

    const answered = [{ servedAt, answeredAt: servedAt, picked: 2, correct: true, timedOut: false, ms: 4000, points: 140 }]
    const saved = await store.saveHuntRun(ids.alice, day, { rounds: answered, score: 140, correct: 1, ms: 4000, finishedAt: null }, 0)
    expect(saved).toMatchObject({ rounds: answered, score: 140, correct: 1, ms: 4000, version: 1 })
    expect(await store.saveHuntRun(ids.alice, day, { rounds: [], score: 0, correct: 0, ms: 0, finishedAt: null }, 0)).toBeNull()
    expect(await store.getHuntRun(ids.alice, day)).toEqual(saved)
  })

  it("lists a player's runs oldest first, and a day's finished runs without demo accounts", async () => {
    const store = getStore()
    let days = [randomDay(), randomDay()]
    while (days[0] === days[1]) days = [randomDay(), randomDay()]
    const [early, late] = days.sort()
    const finish = async (userId, day, score) => {
      const run = await store.createHuntRun(userId, { day, rounds: [] })
      return store.saveHuntRun(userId, day, { rounds: [], score, correct: 3, ms: 9000, finishedAt: new Date().toISOString() }, run.version)
    }
    await finish(ids.alice, late, 300)
    await finish(ids.alice, early, 200)
    await finish(ids.bob, late, 500)
    const demo = await store.createUser({ email: `demo-${crypto.randomUUID()}@demo.glitch`, passwordHash: null, isDemo: true })
    await finish(demo.id, late, 900)
    // Started, not finished: not on the leaderboard.
    const playing = await store.createUser({ email: `hunt-${crypto.randomUUID()}@glitch.test`, passwordHash: null, isDemo: false })
    await store.createHuntRun(playing.id, { day: late, rounds: [] })

    expect((await store.listHuntRuns(ids.alice)).filter((run) => [early, late].includes(run.day)).map((run) => run.day)).toEqual([early, late])
    const board = await store.huntDayRuns(late)
    expect(board.map((run) => run.userId).sort()).toEqual([ids.alice, ids.bob].sort())
    expect(board.find((run) => run.userId === ids.bob)).toMatchObject({ score: 500, correct: 3, ms: 9000, finishedAt: expect.any(String) })
  })
}
