import { expect, it } from 'vitest'
import {
  advance,
  currentStep,
  emptyInterrogation,
  FIX_STEP,
  INTERROGATION_LIMITS,
  INTERROGATION_XP,
  INTERROGATION_STEPS,
  interrogationSummary,
  isFinished,
  timeline,
  triesOnStep,
} from '../../shared/interrogation.js'

const AT = '2026-10-23T10:00:00.000Z'
const pass = { passed: true, feedback: 'Good.', question: 'ignored when passing' }
const miss = { passed: false, feedback: 'Not yet.', question: 'Which line?' }

it('walks the six steps of the method in order, with fix fifth', () => {
  expect(INTERROGATION_STEPS).toEqual(['reproduce', 'read', 'hypothesis', 'isolate', 'fix', 'prevent'])
  expect(FIX_STEP).toBe(4)
  expect(currentStep(emptyInterrogation('c1'))).toBe('reproduce')
  expect(currentStep(null)).toBe('reproduce')
})

it('stays on a step when the answer is off, keeping the guiding question', () => {
  const state = advance(emptyInterrogation('c1'), '  it crashes  ', miss, AT)
  expect(state.step).toBe(0)
  expect(state.turns).toEqual([{ step: 'reproduce', answer: 'it crashes', feedback: 'Not yet.', question: 'Which line?', passed: false, at: AT }])
  expect(triesOnStep(state)).toBe(1)
  expect(state.completedAt).toBeNull()
})

it('moves on when the answer passes, dropping the question', () => {
  const state = advance(emptyInterrogation('c1'), 'calling total([])', pass, AT)
  expect(state.step).toBe(1)
  expect(state.turns[0]).toMatchObject({ passed: true, question: '' })
  expect(currentStep(state)).toBe('read')
  expect(triesOnStep(state)).toBe(0)
})

it('finishes after the sixth pass and stops there', () => {
  let state = emptyInterrogation('c1')
  for (const _ of INTERROGATION_STEPS) state = advance(state, 'answer', pass, AT)
  expect(isFinished(state)).toBe(true)
  expect(state.completedAt).toBe(AT)
  expect(currentStep(state)).toBeNull()
  expect(advance(state, 'more', pass, AT)).toBe(state)
})

it('never edits the state it is given and clips long text', () => {
  const start = emptyInterrogation('c1')
  const state = advance(start, 'x'.repeat(5000), { passed: false, feedback: 'y'.repeat(5000), question: '' }, AT)
  expect(start.turns).toHaveLength(0)
  expect(state.turns[0].answer.length).toBe(INTERROGATION_LIMITS.answer)
  expect(state.turns[0].feedback.length).toBe(INTERROGATION_LIMITS.feedback)
})

it('builds a timeline with the passing answer, tries and status per step', () => {
  let state = advance(emptyInterrogation('c1'), 'first try', miss, AT)
  state = advance(state, 'total([]) breaks', pass, AT)
  const rows = timeline(state)
  expect(rows).toHaveLength(6)
  expect(rows[0]).toMatchObject({ id: 'reproduce', status: 'passed', answer: 'total([]) breaks', feedback: 'Good.', tries: 2 })
  expect(rows[1]).toMatchObject({ id: 'read', status: 'current', answer: null, tries: 0 })
  expect(rows[2].status).toBe('locked')
})

it('counts only finished interrogations for progress', () => {
  let done = emptyInterrogation('c1')
  for (const _ of INTERROGATION_STEPS) done = advance(done, 'a', pass, AT)
  const halfway = advance(emptyInterrogation('c2'), 'a', pass, AT)
  expect(interrogationSummary([done, halfway])).toEqual({ completed: 1 })
  expect(interrogationSummary()).toEqual({ completed: 0 })
})

it('pays interrogation XP per finished case and gives the scientific-method badge', async () => {
  const { computeProgress } = await import('../../shared/progress.js')
  const base = { cases: [], challenges: [], notes: [], study: [], today: '2026-10-23' }
  const none = computeProgress(base)
  const two = computeProgress({ ...base, interrogation: { completed: 2 } })
  expect(two.xp - none.xp).toBe(2 * INTERROGATION_XP)
  const badge = (progress) => progress.badges.find((item) => item.id === 'scientific-method').earned
  expect(badge(none)).toBe(false)
  expect(badge(two)).toBe(true)
})
