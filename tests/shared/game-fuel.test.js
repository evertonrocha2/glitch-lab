// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  AREA_BRANCH, CONCEPT_BRANCH, DAILY_CAPS, MAX_LEVEL, heroLevel, heroXp, pendingStudy, studyLedger, studyRewards,
  talentPoints, xpForLevel,
} from '../../shared/game/fuel.js'
import { EXAMS } from '../../shared/exams/catalog.js'

const mathTopic = EXAMS.enem.areas.find((area) => area.id === 'matematica').topics[0].id
const D1 = '2026-05-01', D2 = '2026-05-02', D3 = '2026-05-03'
const rowOf = (ledger, day) => ledger.days.find((row) => row.day === day)

describe('levels', () => {
  it('starts at level 1 with no xp', () => {
    expect(heroLevel(0)).toMatchObject({ level: 1, into: 0 })
  })
  it('lands exactly on a level floor', () => {
    expect(xpForLevel(14)).toBe(3035)
    expect(heroLevel(xpForLevel(14))).toMatchObject({ level: 14, into: 0 })
    expect(heroLevel(xpForLevel(14) + 5)).toMatchObject({ level: 14, into: 5, needed: xpForLevel(15) - xpForLevel(14) })
  })
  it('caps at the max level', () => {
    const top = heroLevel(10 ** 9)
    expect(top.level).toBe(MAX_LEVEL)
    expect(top.needed).toBe(0)
  })
})

describe('talentPoints', () => {
  it('gives one per level plus one per 10 acertos, capped', () => {
    expect(talentPoints(1, 9)).toBe(0)
    expect(talentPoints(5, 25)).toBe(6)
    expect(talentPoints(60, 10 ** 6)).toBe(89)
  })
})

describe('studyLedger', () => {
  const input = {
    examDays: [{ day: D1, topic: mathTopic, answered: 45, correct: 40 }, { day: D1, topic: 'nope', answered: 2, correct: 1 }],
    cases: [{ id: 'c1', concept: 'off-by-one' }],
    challenges: [
      { caseId: 'c1', status: 'passed', passedAt: `${D1}T10:00:00Z` },
      { caseId: 'c1', puzzleId: 'p', status: 'passed', passedAt: `${D1}T10:00:00Z` },
      { caseId: 'c1', status: 'open', passedAt: null },
    ],
    daily: { solved: [{ kind: 'daily', day: D1, difficulty: 1 }] },
    riddle: { results: [{ day: D1, mode: 'x', guessCount: 3, solved: true }, { day: D1, mode: 'y', guessCount: 6, solved: false }] },
    hunt: { runs: [{ day: D1, correct: 2, answered: 4 }] },
    duel: { results: [
      { day: D1, outcome: 'win', vsBot: true, correct: 3 },
      { day: D1, outcome: 'win', vsBot: false, correct: 4 },
      { day: D1, outcome: 'loss', vsBot: false, correct: 1 },
    ] },
    review: { days: [{ day: D1, cards: 5, right: 4, completed: true }] },
  }
  it('counts acertos per day from every source', () => {
    const row = rowOf(studyLedger(input), D1)
    expect(row).toMatchObject({
      examCorrect: 41, examWrong: 6, wrong: 6, bugs: 1, dailies: 1, glitchdles: 1, huntCorrect: 2,
      duelCorrect: 8, duelWins: 1, duelLosses: 1, reviewRight: 4, reviewDone: 1,
    })
    expect(row.correct).toBe(41 + 1 + 1 + 1 + 2 + 8 + 4)
  })
  it('sums totals and feeds the branches', () => {
    const ledger = studyLedger(input)
    expect(ledger.totals.correct).toBe(rowOf(ledger, D1).correct)
    expect(ledger.branch.algoritmos).toBe(40)
    expect(ledger.branch.logica).toBe(1)
    expect(ledger.branch.sintaxe).toBe(0)
  })
  it('maps concepts and areas to branches', () => {
    expect(CONCEPT_BRANCH['off-by-one']).toBe('logica')
    expect(CONCEPT_BRANCH['key-error']).toBe('sintaxe')
    expect(CONCEPT_BRANCH['async-await']).toBe('algoritmos')
    expect(AREA_BRANCH.matematica).toBe('algoritmos')
  })
  it('ignores global puzzles in daily.solved', () => {
    const ledger = studyLedger({ daily: { solved: [{ kind: 'global', day: D1, difficulty: 1 }] } })
    expect(ledger.totals.dailies).toBe(0)
    expect(studyRewards(ledger)[D1]).toBeUndefined()
  })
  it('survives empty input', () => {
    const ledger = studyLedger({})
    expect(ledger.days).toEqual([])
    expect(ledger.totals.correct).toBe(0)
  })
  it('heroXp adds exam xp on top of app xp', () => {
    expect(heroXp(100, studyLedger(input))).toBe(100 + 12 * 41 + 3 * 6)
  })
})

describe('studyRewards', () => {
  it('pays every fragment a day earns, with no daily cap', () => {
    const ledger = studyLedger({
      examDays: [{ day: D1, topic: mathTopic, answered: 40, correct: 40 }],
      cases: [{ id: 'c', concept: 'other' }],
      challenges: Array.from({ length: 5 }, () => ({ caseId: 'c', status: 'passed', passedAt: `${D1}T01:00:00Z` })),
      daily: { solved: [{ kind: 'daily', day: D1, difficulty: 1 }] },
    })
    expect(studyRewards(ledger)[D1].fragments).toBe(200 + 50 + 15)
    expect(DAILY_CAPS.fragments).toBeUndefined()
  })
  it('boosts the chest on consecutive daily days', () => {
    const ledger = studyLedger({ daily: { solved: [D1, D2, '2026-05-05'].map((day) => ({ kind: 'daily', day, difficulty: 1 })) } })
    const rewards = studyRewards(ledger)
    expect(rewards[D1]).toMatchObject({ chest: 1, chestBoost: 0.1 })
    expect(rewards[D2].chestBoost).toBeCloseTo(0.2)
    expect(rewards['2026-05-05'].chestBoost).toBeCloseTo(0.1)
  })
  it('gives a key per glitchdle day, potions per review day', () => {
    const rewards = studyRewards(studyLedger({
      riddle: { results: [{ day: D1, solved: true }, { day: D1, solved: true }] },
      review: { days: [{ day: D1, cards: 3, right: 3, completed: true }, { day: D2, cards: 1, right: 0, completed: false }] },
    }))
    expect(rewards[D1]).toMatchObject({ key: 1, potions: 3 })
    expect(rewards[D2]).toMatchObject({ key: 0, potions: 0 })
  })
  it('pays honor only for real duels', () => {
    const honor = (vsBot, outcome) => studyRewards(studyLedger({ duel: { results: [{ day: D1, outcome, vsBot, correct: 0 }] } }))[D1].honor
    expect(honor(true, 'win')).toBe(0)
    expect(honor(false, 'win')).toBe(10)
    expect(honor(false, 'loss')).toBe(3)
  })
})

describe('pendingStudy', () => {
  const rewards = studyRewards(studyLedger({
    examDays: [{ day: D1, topic: mathTopic, answered: 10, correct: 10 }],
    daily: { solved: [{ kind: 'daily', day: D1, difficulty: 1 }] },
    riddle: { results: [{ day: D1, solved: true }] },
    duel: { results: [{ day: D1, outcome: 'win', vsBot: false, correct: 0 }] },
  }))
  it('returns the unclaimed half', () => {
    const total = rewards[D1].fragments
    const pending = pendingStudy(rewards, { [D1]: { fragments: total / 2 } })
    expect(pending.fragments).toBe(total - total / 2)
    expect(pending.chests).toEqual([{ day: D1, boost: 0.1 }])
  })
  it('returns zeros when everything is claimed', () => {
    const pending = pendingStudy(rewards, { [D1]: rewards[D1] })
    expect(pending).toMatchObject({ fragments: 0, potions: 0, keys: 0, honor: 0, chests: [] })
  })
  it('never goes below zero', () => {
    expect(pendingStudy(rewards, { [D1]: { fragments: 10 ** 6 } }).fragments).toBe(0)
  })
})
