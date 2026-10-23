// @vitest-environment node
import { expect, it } from 'vitest'
import { buildCard, changedLine, fixDistractors, nearMisses, poolSamples, publicCard, seededRandom } from '../../api/_lib/review/cards.js'
import { POOL } from '../../api/_lib/puzzles/pool.js'
import { REVIEW_CONCEPTS } from '../../shared/review.js'

const OFF_BY_ONE = {
  symptom: 'Prints 1 and 2, but never 3.',
  code: 'items = [1, 2, 3]\nfor i in range(len(items) - 1):\n    print(items[i])',
  solution: 'items = [1, 2, 3]\nfor i in range(len(items)):\n    print(items[i])',
  explanation: 'range stops one early.',
  language: 'python',
}
const CASE_SAMPLE = { error: "TypeError: Cannot read properties of undefined (reading 'city')", code: 'console.log(user.address.city)', explanation: 'user.address is undefined', language: 'javascript' }

it('finds the one line a fix changes, or nothing when it is not one line', () => {
  expect(changedLine(OFF_BY_ONE.code, OFF_BY_ONE.solution)).toEqual({ index: 1, broken: 'for i in range(len(items) - 1):', fixed: 'for i in range(len(items)):' })
  expect(changedLine('a\nb', 'a\nb')).toBeNull()
  expect(changedLine('a\nb\nc', 'a\nB\nC')).toBeNull()
  expect(changedLine('a\nc', 'a\nb\nc')).toBeNull()
  // Trailing spaces and Windows line ends don't count as changes.
  expect(changedLine('a  \r\nb\r\n', 'a\nB\n')).toMatchObject({ index: 1, fixed: 'B' })
})

it('makes near misses and picks distinct wrong fixes', () => {
  expect(nearMisses('if (a <= b) return a')).toEqual(expect.arrayContaining(['if (a < b) return a', 'if (a <= b) a']))
  const wrong = fixDistractors('for i in range(len(items) - 1):', 'for i in range(len(items)):')
  expect(wrong.length).toBeGreaterThanOrEqual(2)
  expect(wrong).not.toContain('for i in range(len(items)):')
  expect(new Set(wrong).size).toBe(wrong.length)
  // Nothing to edit at all: no fix card.
  expect(fixDistractors('foo', 'bar')).toBeNull()
})

it('builds a "what causes this?" card from a real error, with the right concept among four', () => {
  const card = buildCard('undefined-access', [CASE_SAMPLE], { turn: 0, random: seededRandom('x') })
  expect(card.type).toBe('cause')
  expect(card.prompt.error).toBe(CASE_SAMPLE.error)
  expect(card.options).toHaveLength(4)
  expect(card.options.find((option) => option.id === card.answer).value).toBe('undefined-access')
  expect(card.options.every((option) => REVIEW_CONCEPTS.includes(option.value))).toBe(true)
  expect(card.explanation).toBe('user.address is undefined')
  // The browser never sees the answer, and a cause card hides its concept too.
  const visible = publicCard(card, 0)
  expect(visible).toEqual({ index: 0, type: 'cause', concept: null, prompt: card.prompt, options: card.options })
  expect(JSON.stringify(visible)).not.toContain('user.address is undefined')
})

it('rotates to "which line?" and "pick the fix", falling back to other samples', () => {
  const line = buildCard('off-by-one', [CASE_SAMPLE, OFF_BY_ONE], { turn: 1, random: seededRandom('x') })
  expect(line).toMatchObject({ type: 'line', answer: 'l2', fixed: 'for i in range(len(items)):' })
  expect(line.options.map((option) => option.value)).toEqual([0, 1, 2])

  const fix = buildCard('off-by-one', [CASE_SAMPLE, OFF_BY_ONE], { turn: 2, random: seededRandom('x') })
  expect(fix.type).toBe('fix')
  expect(fix.prompt.bugLine).toBe(1)
  expect(fix.options.find((option) => option.id === fix.answer).value).toBe('for i in range(len(items)):')
  expect(publicCard(fix, 3)).not.toHaveProperty('answer')

  // Only an error to go on: every turn falls back to a cause card.
  expect(buildCard('off-by-one', [CASE_SAMPLE], { turn: 2 }).type).toBe('cause')
  expect(buildCard('off-by-one', [])).toBeNull()
})

it('has a working card of every kind for each concept in the pool', () => {
  const concepts = [...new Set(POOL.map((puzzle) => puzzle.concept))]
  for (const concept of concepts) {
    const samples = poolSamples(concept, 'en')
    const types = [0, 1, 2].map((turn) => buildCard(concept, samples, { turn, random: seededRandom(concept) })?.type)
    expect(types[0]).toBe('cause')
    expect(types.every(Boolean)).toBe(true)
  }
  // Pool prose is English: Portuguese readers don't get it as the explanation.
  expect(poolSamples('off-by-one', 'pt-BR')[0].explanation).toBeNull()
})
