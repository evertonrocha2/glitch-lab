// @vitest-environment node
import { expect, it } from 'vitest'
import { BADGES } from '../../shared/badges.js'
import { computeProgress, STUDY_DAY_SECONDS } from '../../shared/progress.js'

const kase = (fields = {}) => ({ id: crypto.randomUUID(), status: 'new', language: 'javascript', ...fields })
const passed = (fields = {}) => ({ id: crypto.randomUUID(), status: 'passed', hintsRevealed: 1, ...fields })
const empty = { cases: [], challenges: [], notes: [], study: [], today: '2026-10-22' }
const earned = (progress) => progress.badges.filter((badge) => badge.earned).map((badge) => badge.id)

it('starts a new account at level 1 with nothing earned', () => {
  const progress = computeProgress(empty)
  expect(progress).toMatchObject({ xp: 0, level: 1, title: 'Rookie', levelXp: 0, nextLevelXp: 100, streak: 0, todaySeconds: 0, totalSeconds: 0 })
  expect(progress.badges).toHaveLength(BADGES.length)
  expect(earned(progress)).toEqual([])
})

it('adds up xp from cases, passes, solved cases, notes and study minutes', () => {
  const progress = computeProgress({
    ...empty,
    cases: [kase(), kase({ status: 'solved' })],
    challenges: [passed(), passed({ hintsRevealed: 0 }), { id: 'x', status: 'open', hintsRevealed: 0 }],
    notes: [{ id: 'n1', blocks: [] }],
    study: [{ day: '2026-10-22', seconds: 600 }],
  })
  // cases 2*10 + passes 2*30 + clean pass 15 + solved 50 + note 5 + 10 minutes
  expect(progress.xp).toBe(20 + 60 + 15 + 50 + 5 + 10)
  expect(progress).toMatchObject({ level: 2, title: 'Junior Detective', levelXp: 100, nextLevelXp: 300 })
})

it('counts at most 20 notes toward xp', () => {
  const notes = Array.from({ length: 30 }, (_, index) => ({ id: `n${index}`, blocks: [] }))
  expect(computeProgress({ ...empty, notes }).xp).toBe(100)
})

it('has no next level at the top', () => {
  const study = [{ day: '2026-10-22', seconds: 2000 * 60 }]
  expect(computeProgress({ ...empty, study })).toMatchObject({ title: 'Bug Whisperer', nextLevelXp: null })
})

it('counts the study streak up to today or yesterday', () => {
  const day = (d, seconds = STUDY_DAY_SECONDS) => ({ day: d, seconds })
  const study = [day('2026-10-19'), day('2026-10-20'), day('2026-10-21')]
  expect(computeProgress({ ...empty, study }).streak).toBe(3)
  expect(computeProgress({ ...empty, study: [...study, day('2026-10-22')] }).streak).toBe(4)
  expect(computeProgress({ ...empty, study, today: '2026-10-23' }).streak).toBe(0)
  // A day with less than five minutes breaks it.
  expect(computeProgress({ ...empty, study: [day('2026-10-20'), day('2026-10-21', 60)] }).streak).toBe(0)
})

it("reports today's and total study time", () => {
  const study = [
    { day: '2026-10-21', seconds: 100 },
    { day: '2026-10-22', seconds: 50 },
  ]
  expect(computeProgress({ ...empty, study })).toMatchObject({ todaySeconds: 50, totalSeconds: 150 })
})

it('earns the case and gym badges', () => {
  const cases = [kase({ status: 'solved' }), kase({ language: 'python' }), kase({ language: 'java' })]
  const challenges = [passed({ hintsRevealed: 0 })]
  expect(earned(computeProgress({ ...empty, cases, challenges }))).toEqual(['first-clue', 'fixed-it', 'case-closed', 'sharp-eye', 'polyglot'])
})

it('earns bug hunter and collector with enough cases', () => {
  const cases = [...Array.from({ length: 5 }, () => kase({ status: 'solved' })), ...Array.from({ length: 5 }, () => kase())]
  expect(earned(computeProgress({ ...empty, cases }))).toEqual(expect.arrayContaining(['bug-hunter', 'collector']))
})

it('earns note taker only for a note that mentions a case', () => {
  const plain = [{ id: 'n1', blocks: [{ type: 'text', text: 'hi' }] }]
  expect(earned(computeProgress({ ...empty, notes: plain }))).not.toContain('note-taker')
  const linked = [{ id: 'n2', blocks: [{ type: 'case', caseId: 'c1' }] }]
  expect(earned(computeProgress({ ...empty, notes: linked }))).toContain('note-taker')
})

it('keeps streak badges after the streak ends', () => {
  const study = ['2026-10-01', '2026-10-02', '2026-10-03'].map((day) => ({ day, seconds: 25 * 60 }))
  const progress = computeProgress({ ...empty, study })
  expect(progress.streak).toBe(0)
  expect(earned(progress)).toEqual(['deep-focus', 'on-a-roll'])
})

it('earns marathon at five hours in total', () => {
  const study = Array.from({ length: 5 }, (_, index) => ({ day: `2026-09-0${index + 1}`, seconds: 3600 }))
  expect(earned(computeProgress({ ...empty, study }))).toContain('marathon')
})
