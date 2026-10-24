// @vitest-environment node
import { expect, it } from 'vitest'
import { hasMarks, listNumbers, noteAsText, parseInline, plainInline, safeHref } from '../../shared/note-blocks.js'

it('splits a line into bold, italic, code, strike and link pieces', () => {
  expect(parseInline('Use **?.** or *optional* `a?.b` ~~not this~~ [docs](https://developer.mozilla.org/x)!')).toEqual([
    { type: 'text', text: 'Use ' },
    { type: 'bold', text: '?.' },
    { type: 'text', text: ' or ' },
    { type: 'italic', text: 'optional' },
    { type: 'text', text: ' ' },
    { type: 'code', text: 'a?.b' },
    { type: 'text', text: ' ' },
    { type: 'strike', text: 'not this' },
    { type: 'text', text: ' ' },
    { type: 'link', text: 'docs', href: 'https://developer.mozilla.org/x' },
    { type: 'text', text: '!' },
  ])
  expect(parseInline('plain words')).toEqual([{ type: 'text', text: 'plain words' }])
  // A lone star or a math expression is not italic.
  expect(parseInline('2 * 3 * 4')).toEqual([{ type: 'text', text: '2 * 3 * 4' }])
  // Marks inside inline code stay as typed.
  expect(parseInline('`**x**`')).toEqual([{ type: 'code', text: '**x**' }])
})

it('never turns a non-web link into something to click', () => {
  for (const url of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,hi', 'vbscript:x', '//evil.example', 'ftp://x.y']) {
    expect(safeHref(url), url).toBeNull()
    expect(parseInline(`[click](${url})`).some((part) => part.type === 'link'), url).toBe(false)
  }
  expect(parseInline('[click](javascript:alert(1))').map((part) => part.text).join('')).toContain('click')
  expect(safeHref('http://example.com')).toBe('http://example.com/')
})

it('tells marks apart from plain text and strips them', () => {
  expect(hasMarks('just text')).toBe(false)
  expect(hasMarks('a **b**')).toBe(true)
  expect(plainInline('**Tip:** see [the docs](https://x.dev) and `map`')).toBe('Tip: see the docs and map')
})

it('numbers each run of numbered items, per level', () => {
  const blocks = [
    { id: 'a', type: 'numbered', text: '' },
    { id: 'b', type: 'numbered', text: '', indent: 1 },
    { id: 'c', type: 'numbered', text: '', indent: 1 },
    { id: 'd', type: 'numbered', text: '' },
    { id: 'e', type: 'text', text: '' },
    { id: 'f', type: 'numbered', text: '' },
  ]
  expect(Object.fromEntries(listNumbers(blocks))).toEqual({ a: 1, b: 1, c: 2, d: 2, f: 1 })
})

it('writes a note as plain text with its structure and code fences', () => {
  const text = noteAsText(
    [
      { id: '1', type: 'heading', text: 'Loops', level: 2 },
      { id: '2', type: 'bullet', text: '**for** each' },
      { id: '3', type: 'bullet', text: 'nested', indent: 1 },
      { id: '4', type: 'numbered', text: 'first' },
      { id: '5', type: 'quote', text: 'one\ntwo' },
      { id: '6', type: 'code', text: 'for i in range(3):\n    print(i)', language: 'python' },
      { id: '7', type: 'divider' },
      { id: '8', type: 'callout', text: 'Watch the end', tone: 'warning', emoji: '⚠️' },
      { id: '9', type: 'case', caseId: 'c1' },
    ],
    (block) => `[case ${block.caseId}]`,
  )
  expect(text).toBe(['## Loops', '- for each', '  - nested', '1. first', '> one\n> two', '```python\nfor i in range(3):\n    print(i)\n```', '---', '⚠️ Watch the end', '[case c1]'].join('\n'))
})
