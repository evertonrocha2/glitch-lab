// @vitest-environment node
import { expect, it } from 'vitest'
import { cleanQuery, COMMUNITY_LIMITS, excerpt, parseBody, parseTags, splitInline, tagProblem } from '../../shared/community.js'

it('turns typed tags into unique lowercase words', () => {
  expect(parseTags('JavaScript, undefined  python,javascript')).toEqual(['javascript', 'undefined', 'python'])
  expect(parseTags(['Off-By-One', ' loops '])).toEqual(['off-by-one', 'loops'])
  expect(parseTags('')).toEqual([])
  expect(parseTags('#react')).toEqual(['react'])
})

it('explains what is wrong with a tag', () => {
  expect(tagProblem('react')).toBeNull()
  expect(tagProblem('c++')).toMatch(/letters, numbers/)
  expect(tagProblem('a'.repeat(COMMUNITY_LIMITS.tag + 1))).toMatch(/up to/)
})

it('splits a body into paragraphs and fenced code blocks', () => {
  const body = 'First line\nsame paragraph\n\n\nSecond `x.y` here\n\n```js\nconst a = {}\n\nconsole.log(a.b)\n```\nAfter'
  expect(parseBody(body)).toEqual([
    { type: 'paragraph', text: 'First line\nsame paragraph' },
    { type: 'paragraph', text: 'Second `x.y` here' },
    { type: 'code', lang: 'js', text: 'const a = {}\n\nconsole.log(a.b)' },
    { type: 'paragraph', text: 'After' },
  ])
})

it('keeps an unclosed fence as code to the end', () => {
  expect(parseBody('Look:\n```\nx = 1')).toEqual([
    { type: 'paragraph', text: 'Look:' },
    { type: 'code', lang: '', text: 'x = 1' },
  ])
  expect(parseBody('  \n\n ')).toEqual([])
})

it('splits inline code out of a paragraph', () => {
  expect(splitInline('Use `a?.b` not `a.b` here')).toEqual([
    { code: false, text: 'Use ' },
    { code: true, text: 'a?.b' },
    { code: false, text: ' not ' },
    { code: true, text: 'a.b' },
    { code: false, text: ' here' },
  ])
  expect(splitInline('a lone ` tick')).toEqual([{ code: false, text: 'a lone ` tick' }])
})

it('makes a short plain excerpt without code blocks', () => {
  const body = `Intro with \`code\`.\n\n\`\`\`\nsecret()\n\`\`\`\n\n${'word '.repeat(80)}`
  const text = excerpt(body, 60)
  expect(text.startsWith('Intro with code.')).toBe(true)
  expect(text).not.toContain('secret')
  expect(text.length).toBeLessThanOrEqual(61)
  expect(text.endsWith('…')).toBe(true)
  expect(excerpt('Short one.')).toBe('Short one.')
})

it('cleans a search query down to safe characters', () => {
  expect(cleanQuery('  undefined   everywhere ')).toBe('undefined everywhere')
  expect(cleanQuery('a,b(c)"d%e*f\\g')).toBe('a b c d e f g')
  expect(cleanQuery('snake_case.js @ada #tag c++')).toBe('snake_case.js @ada #tag c++')
  expect(cleanQuery('x'.repeat(200))).toHaveLength(COMMUNITY_LIMITS.query)
  expect(cleanQuery(42)).toBe('')
})
