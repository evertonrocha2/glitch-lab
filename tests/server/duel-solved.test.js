// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildResult, timeline } from '../../server/modules/duels/clock.js'
import { loadDuel } from '../../server/modules/duels/solved.js'

// A finished 3-round duel: ada answers rounds 0 and 1 right and round 2 wrong, bob gets round 2 right.
const start = Date.parse('2026-05-01T10:00:00Z')
const roundAt = (index) => start + 3000 + index * 20_000
const at = (index, extra) => new Date(roundAt(index) + extra).toISOString()
const duel = {
  kind: 'friend',
  status: 'finished',
  startAt: new Date(start).toISOString(),
  finishedAt: '2026-05-01T10:02:00Z',
  players: [{ userId: 'ada' }, { userId: 'bob' }],
  rounds: [{ answer: 0 }, { answer: 1 }, { answer: 2 }],
  focus: [],
  answers: [
    { userId: 'ada', round: 0, choice: 0, at: at(0, 2000) },
    { userId: 'ada', round: 1, choice: 1, at: at(1, 2000) },
    { userId: 'ada', round: 2, choice: 0, at: at(2, 2000) },
    { userId: 'bob', round: 2, choice: 2, at: at(2, 3000) },
  ],
}
const listing = (result) => ({
  listDuels: async () => [{ id: 'd1', kind: 'friend', players: duel.players, finishedAt: duel.finishedAt, result }],
})

describe('finished duel result', () => {
  it('stores rounds answered right for both players', () => {
    const now = Date.parse(duel.finishedAt)
    const result = buildResult(duel, timeline(duel, now), now)
    expect(result.players.map((item) => [item.userId, item.correct])).toEqual([['ada', 2], ['bob', 1]])
  })
})

describe('loadDuel', () => {
  it('uses the stored correct count, not the points', async () => {
    const result = { early: false, players: [{ userId: 'ada', score: 380, correct: 2, outcome: 'win', fastestMs: 2000 }, { userId: 'bob', score: 0, correct: 0, outcome: 'loss' }] }
    const { results } = await loadDuel(listing(result), 'ada')
    expect(results[0]).toMatchObject({ day: '2026-05-01', outcome: 'win', vsBot: false, correct: 2 })
  })
  it('estimates legacy duels from the score', async () => {
    const result = { early: false, players: [{ userId: 'ada', score: 450, outcome: 'win' }] }
    expect((await loadDuel(listing(result), 'ada')).results[0].correct).toBe(2)
  })
})
