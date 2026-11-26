// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { loadDuel } from '../../server/modules/duels/solved.js'

// A finished 3-round duel: ada answers rounds 0 and 1 right and round 2 wrong, so her points are in
// the hundreds but her correct count must be 2.
const start = Date.parse('2026-05-01T10:00:00Z')
const roundAt = (index) => start + 3000 + index * 20_000
const duel = {
  kind: 'friend',
  status: 'finished',
  startAt: new Date(start).toISOString(),
  finishedAt: '2026-05-01T10:02:00Z',
  players: [{ userId: 'ada' }, { userId: 'bob' }],
  rounds: [{ answer: 0 }, { answer: 1 }, { answer: 2 }],
  focus: [],
  answers: [
    { userId: 'ada', round: 0, choice: 0, at: new Date(roundAt(0) + 2000).toISOString() },
    { userId: 'ada', round: 1, choice: 1, at: new Date(roundAt(1) + 2000).toISOString() },
    { userId: 'ada', round: 2, choice: 0, at: new Date(roundAt(2) + 2000).toISOString() },
  ],
  result: { early: false, players: [{ userId: 'ada', score: 380, outcome: 'win', fastestMs: 2000 }, { userId: 'bob', score: 0, outcome: 'loss' }] },
}

describe('loadDuel', () => {
  it('reports rounds answered right, not duel points', async () => {
    const store = { listDuels: async () => [{ ...duel, id: 'd1', rounds: undefined, answers: undefined }], getDuel: async () => duel }
    const { results } = await loadDuel(store, 'ada')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ day: '2026-05-01', outcome: 'win', vsBot: false, correct: 2 })
    expect(results[0].score).toBeUndefined()
  })
})
