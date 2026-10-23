// @vitest-environment node
import { expect, it } from 'vitest'
import { CONCEPTS } from '../../shared/concepts.js'
import { buildPuzzlePrompt, PUZZLE_SCHEMA, PUZZLE_SYSTEM } from '../../server/modules/daily/puzzle.prompt.js'
import { LANGUAGES_BY_CONCEPT, parsePuzzle, planSlot } from '../../server/modules/daily/puzzle-generate.js'
import { AI_PUZZLE, AI_PUZZLE_PT, AI_SECRET_PT } from './puzzle-fixtures.js'

const parse = (data, options = {}) => parsePuzzle(data, { kind: 'daily', recentTitles: [], ...options })

it('splits a good answer into the public puzzle and its secret, each with its Portuguese copy', () => {
  expect(parse(AI_PUZZLE)).toEqual({
    puzzle: { title: AI_PUZZLE.title, brokenCode: AI_PUZZLE.brokenCode, symptom: AI_PUZZLE.symptom, hints: AI_PUZZLE.hints, pt: AI_PUZZLE_PT },
    secret: { solution: AI_PUZZLE.solution, bugExplanation: AI_PUZZLE.bugExplanation, pt: AI_SECRET_PT },
  })
})

it.each([
  ['no Portuguese title', { ...AI_PUZZLE, titlePt: '' }],
  ['no Portuguese symptom', { ...AI_PUZZLE, symptomPt: undefined }],
  ['two Portuguese hints', { ...AI_PUZZLE, hintsPt: ['um', 'dois'] }],
  ['a blank Portuguese hint', { ...AI_PUZZLE, hintsPt: ['um', ' ', 'três'] }],
  ['no Portuguese explanation', { ...AI_PUZZLE, bugExplanationPt: ' ' }],
  ['a Portuguese title on two lines', { ...AI_PUZZLE, titlePt: 'Linha um\nlinha dois' }],
  ['a very long Portuguese title', { ...AI_PUZZLE, titlePt: 'x'.repeat(61) }],
])('rejects an answer with %s', (_label, data) => {
  expect(() => parse(data)).toThrow()
})

it('swaps em dashes in the Portuguese prose too', () => {
  const parsed = parse({ ...AI_PUZZLE, symptomPt: 'Quebra — sempre', hintsPt: ['a — b', 'c', 'd'], bugExplanationPt: 'x — y' })
  expect(parsed.puzzle.pt.symptom).toBe('Quebra, sempre')
  expect(parsed.puzzle.pt.hints[0]).toBe('a, b')
  expect(parsed.secret.pt.bugExplanation).toBe('x, y')
})

it('asks for every reader-facing text in English and in Brazilian Portuguese, with one copy of the code', () => {
  const prompt = buildPuzzlePrompt({ kind: 'daily', difficulty: 'easy', language: 'python', conceptName: 'Off by one', avoidTitles: [] })
  expect(prompt).toMatch(/titlePt, symptomPt, hintsPt \(exactly 3, in the same order\) and bugExplanationPt/)
  expect(prompt).toMatch(/Brazilian Portuguese/)
  expect(PUZZLE_SCHEMA.required).toEqual(expect.arrayContaining(['titlePt', 'symptomPt', 'hintsPt', 'bugExplanationPt']))
  expect(PUZZLE_SYSTEM).toMatch(/The code is written once and is the same for both/)
})

it('keeps the first three hints and trims the title', () => {
  const parsed = parse({ ...AI_PUZZLE, title: '  The lost index ', hints: [...AI_PUZZLE.hints, 'a fourth'] })
  expect(parsed.puzzle.hints).toEqual(AI_PUZZLE.hints)
  expect(parsed.puzzle.title).toBe('The lost index')
})

it('swaps em dashes in the prose for commas', () => {
  const parsed = parse({ ...AI_PUZZLE, symptom: 'It crashes \u2014 every time' })
  expect(parsed.puzzle.symptom).toBe('It crashes, every time')
})

it.each([
  ['a missing field', { ...AI_PUZZLE, solution: '' }],
  ['only two hints', { ...AI_PUZZLE, hints: ['one', 'two'] }],
  ['a blank hint', { ...AI_PUZZLE, hints: ['one', ' ', 'three'] }],
  ['a title on two lines', { ...AI_PUZZLE, title: 'Line one\nline two' }],
  ['a very long title', { ...AI_PUZZLE, title: 'x'.repeat(61) }],
  ['code in Markdown fences', { ...AI_PUZZLE, brokenCode: '```python\nprint(1)\n```' }],
  ['a solution identical to the bug', { ...AI_PUZZLE, solution: ` ${AI_PUZZLE.brokenCode}\n` }],
  ['too many lines for a daily', { ...AI_PUZZLE, brokenCode: Array.from({ length: 21 }, () => 'x = 1').join('\n') }],
  ['a non-object answer', 'nope'],
])('rejects %s', (_label, data) => {
  expect(() => parse(data)).toThrow()
})

it('allows a longer program for the global challenge', () => {
  const brokenCode = Array.from({ length: 30 }, (_, index) => `x${index} = ${index}`).join('\n')
  expect(parse({ ...AI_PUZZLE, brokenCode }, { kind: 'global' }).puzzle.brokenCode).toBe(brokenCode)
})

it('rejects a title used recently, in any case', () => {
  expect(() => parse(AI_PUZZLE, { recentTitles: ['THE LOST INDEX'] })).toThrow()
})

it('gives each daily of a day a different bug type, in a language that fits it', () => {
  const plans = ['easy', 'medium', 'hard'].map((difficulty) => planSlot({ kind: 'daily', day: '2026-10-22', difficulty }))
  expect(new Set(plans.map((plan) => plan.concept)).size).toBe(3)
  for (const plan of plans) expect(LANGUAGES_BY_CONCEPT[plan.concept]).toContain(plan.language)
})

it('rotates bug types and languages across the week', () => {
  const week = Array.from({ length: 7 }, (_, index) => planSlot({ kind: 'daily', day: `2026-10-${19 + index}`, difficulty: 'easy' }))
  expect(new Set(week.map((plan) => plan.concept)).size).toBe(7)
  expect(new Set(week.map((plan) => plan.language)).size).toBeGreaterThanOrEqual(2)
  expect(planSlot({ kind: 'global', day: '2026-10-19', difficulty: 'hard' }).concept).not.toBe(
    planSlot({ kind: 'global', day: '2026-10-26', difficulty: 'hard' }).concept,
  )
})

it('only plans real bug types', () => {
  const ids = CONCEPTS.map((concept) => concept.id).filter((id) => id !== 'other')
  expect(Object.keys(LANGUAGES_BY_CONCEPT).sort()).toEqual([...ids].sort())
})

it('asks for the slot and lists the titles to avoid', () => {
  const prompt = buildPuzzlePrompt({ kind: 'daily', difficulty: 'hard', language: 'python', conceptName: 'Shared reference', avoidTitles: ['Old one', 'Older one'] })
  expect(prompt).toContain('python')
  expect(prompt).toContain('Shared reference')
  expect(prompt).toMatch(/hard/i)
  expect(prompt).toContain('- Old one\n- Older one')
  expect(buildPuzzlePrompt({ kind: 'global', difficulty: 'hard', language: 'javascript', conceptName: 'Off by one', avoidTitles: [] })).toMatch(/two bugs/i)
})
