// @vitest-environment node
import { expect, it } from 'vitest'
import { fixLines, guardReply, revealsFix } from '../../api/_lib/interrogation/guard.js'

const CODE = 'const user = {}\nconsole.log(user.name.length)'
const FIX = 'Check that user.name exists first:\nif (user.name) console.log(user.name.length)'

it('takes the fix lines the broken code does not already have', () => {
  const lines = fixLines(FIX, CODE)
  expect(lines).toContain('if(user.name)console.log(user.name.length)')
  // Shared with the student's own code, so quoting it gives nothing away.
  expect(fixLines('console.log(user.name.length)', CODE)).toEqual([])
  // Plain prose and tiny bits are not code.
  expect(fixLines('Add a check first.\n}', CODE)).toEqual([])
})

it('finds a fix line inside a reply, whatever the spacing or quotes', () => {
  const lines = fixLines(FIX, CODE)
  expect(revealsFix('Try `if ( user.name )  console.log(user.name.length)` instead.', lines)).toBe(true)
  expect(revealsFix('What is user.name right before line 2?', lines)).toBe(false)
})

it('swaps a reply that leaks the fix before the fix step, keeping the verdict', () => {
  const verdict = { passed: false, feedback: 'Just write if (user.name) console.log(user.name.length).', question: 'Ok?' }
  const { verdict: safe, blocked } = guardReply(verdict, { step: 'hypothesis', fix: FIX, code: CODE })
  expect(blocked).toBe(true)
  expect(safe.passed).toBe(false)
  expect(safe.feedback).not.toContain('if (user.name)')
  expect(safe.question).toBe('What do you think that value is at that moment, and why?')
})

it('also blocks a leaking question and code fences, in Portuguese too', () => {
  const leaky = { passed: true, feedback: 'Boa.', question: 'if (user.name) console.log(user.name.length)?' }
  const { verdict, blocked } = guardReply(leaky, { step: 'read', fix: FIX, code: CODE, locale: 'pt-BR' })
  expect(blocked).toBe(true)
  expect(verdict).toMatchObject({ passed: true, question: '' })
  expect(verdict.feedback).toMatch(/ainda não vou te dar a correção/)
  const fenced = guardReply({ passed: false, feedback: '```js\nx\n```', question: '' }, { step: 'isolate', fix: FIX, code: CODE })
  expect(fenced.blocked).toBe(true)
})

it('lets the coach talk about the fix from the fix step on', () => {
  const verdict = { passed: true, feedback: 'Yes: if (user.name) console.log(user.name.length) works.', question: '' }
  expect(guardReply(verdict, { step: 'fix', fix: FIX, code: CODE })).toEqual({ verdict, blocked: false })
  expect(guardReply(verdict, { step: 'prevent', fix: FIX, code: CODE }).blocked).toBe(false)
})

it('leaves a clean reply alone', () => {
  const verdict = { passed: false, feedback: 'Close.', question: 'Which value is undefined?' }
  expect(guardReply(verdict, { step: 'reproduce', fix: FIX, code: CODE })).toEqual({ verdict, blocked: false })
})
