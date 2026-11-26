import { expect, it } from 'vitest'
import { worldSignals } from '../../shared/world/signals.js'
import { haveFor, nextGoal, openZones, unlocks } from '../../shared/world/unlocks.js'
import { WORLDS } from '../../shared/world/worlds.js'

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

it('opens every zone inside every world from the start, with nothing to study for them', () => {
  const state = unlocks(signals())
  for (const world of WORLDS) {
    expect(state.zones[world.id].map((zone) => zone.id)).toEqual(world.zones.map((zone) => zone.id))
    for (const zone of state.zones[world.id]) expect(zone).toEqual({ id: zone.id, unlocked: true, requirement: null, have: null, need: null })
    expect(openZones(state, world.id)).toEqual(new Set(world.zones.map((zone) => zone.id)))
  }
  expect(openZones(state, 'nope')).toEqual(new Set())
})

it('keeps no study requirement on any zone of the maps', () => {
  for (const world of WORLDS) for (const zone of world.zones) expect(zone.requirement ?? null).toBeNull()
})

it('picks the locked world with the least left, in world order on a tie', () => {
  // The cave and the tower both have 1 left: the cave comes first.
  expect(nextGoal(unlocks(signals({ codeSolved: 2, matematica: 4 })))).toEqual({
    worldId: 'caverna-sql',
    zoneId: null,
    requirement: { signal: 'codeSolved', count: 3 },
    have: 2,
    need: 3,
  })
})

it('never names a zone as the next goal', () => {
  // The cave's zone 2 used to wait for 8 code challenges (1 left here); now the tower, 2 left, is the goal.
  expect(nextGoal(unlocks(signals({ codeSolved: 7, matematica: 3 })))).toMatchObject({ worldId: 'torre-matematica', zoneId: null, have: 3, need: 5 })
})

it('has no goal once every world is open', () => {
  expect(nextGoal(unlocks(signals({ codeSolved: 3, linguagens: 5, humanas: 5, natureza: 5, matematica: 5 })))).toBeNull()
})
