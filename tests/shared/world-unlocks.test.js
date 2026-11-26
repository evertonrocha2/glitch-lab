import { expect, it } from 'vitest'
import { worldSignals } from '../../shared/world/signals.js'
import { haveFor, nextGoal, openZones, unlocks } from '../../shared/world/unlocks.js'

const EMPTY = { examSummary: [], challenges: [], daily: { solved: [] }, riddle: { results: [] }, hunt: { runs: [] } }
const signals = ({ codeSolved = 0, ...areas } = {}) => ({
  enemCorrect: { linguagens: 0, humanas: 0, natureza: 0, matematica: 0, ...areas },
  codeSolved,
})
const worldOf = (state, id) => state.worlds.find((world) => world.id === id)
const zoneOf = (state, worldId, zoneId) => state.zones[worldId].find((zone) => zone.id === zoneId)

it('counts right answers by area from the first attempts', () => {
  const result = worldSignals({
    ...EMPTY,
    examSummary: [
      { topic: 'funcoes', answered: 4, correct: 3 },
      { topic: 'estatistica', answered: 2, correct: 2 },
      { topic: 'literatura', answered: 1, correct: 1 },
      { topic: 'sumiu-do-catalogo', answered: 9, correct: 9 },
    ],
  })
  expect(result.enemCorrect).toEqual({ linguagens: 1, humanas: 0, natureza: 0, matematica: 5 })
})

it('counts each solved thing once for codeSolved', () => {
  const result = worldSignals({
    examSummary: [],
    challenges: [
      { status: 'passed', puzzleId: null },
      { status: 'passed', puzzleId: null },
      { status: 'passed', puzzleId: 'p1' },
      { status: 'open', puzzleId: null },
    ],
    daily: { solved: [{ kind: 'daily', day: '2026-11-01', difficulty: 'easy' }] },
    riddle: {
      results: [
        { day: '2026-11-01', mode: 'a', guessCount: 3, solved: true },
        { day: '2026-11-01', mode: 'b', guessCount: 2, solved: true },
        { day: '2026-11-02', mode: 'a', guessCount: 6, solved: false },
      ],
    },
    hunt: {
      runs: [
        { day: '2026-11-01', correct: 6, answered: 8 },
        { day: '2026-11-02', correct: 2, answered: 5 },
      ],
    },
  })
  // 2 gym passes, 1 daily (its challenge isn't a gym pass), 1 Glitchdle day, 1 finished hunt.
  expect(result.codeSolved).toBe(5)
})

it('starts at zero with nothing done', () => {
  expect(worldSignals(EMPTY)).toEqual(signals())
})

it('reads how much of a requirement is done', () => {
  expect(haveFor({ signal: 'codeSolved', count: 3 }, signals({ codeSolved: 2 }))).toBe(2)
  expect(haveFor({ signal: 'enemCorrect', area: 'matematica', count: 5 }, signals({ matematica: 7, humanas: 1 }))).toBe(7)
})

it('opens the hub, the forest and its zones for a new player', () => {
  const state = unlocks(signals())
  expect(state.worlds.filter((world) => world.unlocked).map((world) => world.id)).toEqual(['laboratorio', 'floresta-js'])
  expect(worldOf(state, 'floresta-js')).toEqual({ id: 'floresta-js', unlocked: true, requirement: null, have: null, need: null })
  expect(worldOf(state, 'torre-matematica')).toMatchObject({ unlocked: false, have: 0, need: 5 })
  expect(zoneOf(state, 'floresta-js', 'z2')).toMatchObject({ unlocked: true, have: null, need: null })
  expect(state.zones.laboratorio).toEqual([])
  expect(openZones(state, 'floresta-js')).toEqual(new Set(['z2', 'z3']))
})

it('opens the SQL cave at exactly 3 solved', () => {
  expect(worldOf(unlocks(signals({ codeSolved: 2 })), 'caverna-sql')).toMatchObject({ unlocked: false, have: 2, need: 3 })
  expect(worldOf(unlocks(signals({ codeSolved: 3 })), 'caverna-sql')).toMatchObject({ unlocked: true, have: 3, need: 3 })
})

it('opens Math zone 2 at 15 right answers in Math and not with other areas', () => {
  expect(zoneOf(unlocks(signals({ humanas: 40, matematica: 14 })), 'torre-matematica', 'z2').unlocked).toBe(false)
  const state = unlocks(signals({ matematica: 15 }))
  expect(zoneOf(state, 'torre-matematica', 'z2')).toMatchObject({ unlocked: true, have: 15, need: 15 })
  expect(openZones(state, 'torre-matematica')).toEqual(new Set(['z2']))
  expect(openZones(state, 'nope')).toEqual(new Set())
})

it('picks the locked goal with the least left, in world order on a tie', () => {
  // The cave and the tower both have 1 left: the cave comes first.
  expect(nextGoal(unlocks(signals({ codeSolved: 2, matematica: 4 })))).toEqual({
    worldId: 'caverna-sql',
    zoneId: null,
    requirement: { signal: 'codeSolved', count: 3 },
    have: 2,
    need: 3,
  })
  // The forest's zones are open now: the cave's z3 is the next goal.
  expect(nextGoal(unlocks(signals({ codeSolved: 19, linguagens: 5, humanas: 5, natureza: 5, matematica: 5 })))).toMatchObject({
    worldId: 'caverna-sql',
    zoneId: 'z3',
    have: 19,
    need: 20,
  })
})

it('puts a world before a zone with as much left', () => {
  // The forest's z3 and the tower both have 1 left.
  expect(nextGoal(unlocks(signals({ codeSolved: 19, matematica: 4 })))).toMatchObject({ worldId: 'torre-matematica', zoneId: null })
})

it('has no goal once everything is open', () => {
  expect(nextGoal(unlocks(signals({ codeSolved: 20, linguagens: 40, humanas: 40, natureza: 40, matematica: 40 })))).toBeNull()
})
