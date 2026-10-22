import { expect, it } from 'vitest'
import { insertAfter, matchCases, mentionAt, mentionsCase, newBlock, placeCase, removeBlock, updateBlock } from './blocks.js'

const text = (id, value) => ({ id, type: 'text', text: value })

it('finds the mention being typed', () => {
  expect(mentionAt('see @type', 9)).toEqual({ start: 4, query: 'type' })
  expect(mentionAt('@', 1)).toEqual({ start: 0, query: '' })
  expect(mentionAt('mail me@x.com', 13)).toBeNull()
  expect(mentionAt('see @type and more', 18)).toBeNull()
})

it('builds blocks of each type', () => {
  expect(newBlock('todo')).toMatchObject({ type: 'todo', text: '', done: false })
  expect(newBlock('case', { caseId: 'c1' })).toMatchObject({ type: 'case', caseId: 'c1' })
  expect(newBlock('heading').id).toEqual(expect.any(String))
})

it('updates, inserts and removes without touching the original', () => {
  const blocks = [text('a', 'one'), text('b', 'two')]
  expect(updateBlock(blocks, 'a', { text: 'uno' })[0].text).toBe('uno')
  expect(insertAfter(blocks, 'a', text('x', '')).map((block) => block.id)).toEqual(['a', 'x', 'b'])
  expect(removeBlock(blocks, 'a').map((block) => block.id)).toEqual(['b'])
  expect(blocks[0].text).toBe('one')
})

it('puts the case after the text and removes the mention', () => {
  const blocks = [text('a', 'This broke again @undef'), text('b', 'later')]
  const { blocks: next, focusId } = placeCase(blocks, 'a', 'c1', { start: 17, query: 'undef' })
  expect(next.map((block) => block.type)).toEqual(['text', 'case', 'text'])
  expect(next[0].text).toBe('This broke again')
  expect(next[1].caseId).toBe('c1')
  expect(focusId).toBe('b')
})

it('replaces a block that only had the mention, and adds somewhere to keep writing', () => {
  const { blocks: next, focusId } = placeCase([text('a', '@')], 'a', 'c1', { start: 0, query: '' })
  expect(next.map((block) => block.type)).toEqual(['case', 'text'])
  expect(focusId).toBe(next[1].id)
})

it('appends the case when no block is picked', () => {
  const { blocks: next } = placeCase([], null, 'c1', { start: 0, query: '' })
  expect(next.map((block) => block.type)).toEqual(['case', 'text'])
})

it('matches cases by error, bug type or language', () => {
  const cases = [
    { id: '1', error: 'TypeError: x', concept: 'undefined-access', language: 'javascript' },
    { id: '2', error: 'IndexError: list', concept: 'index-out-of-range', language: 'python' },
  ]
  const label = (concept) => (concept === 'undefined-access' ? 'Reading undefined' : 'Index out of range')
  expect(matchCases(cases, 'index', label).map((item) => item.id)).toEqual(['2'])
  expect(matchCases(cases, 'UNDEFINED', label).map((item) => item.id)).toEqual(['1'])
  expect(matchCases(cases, 'python', label).map((item) => item.id)).toEqual(['2'])
  expect(matchCases(cases, ' ', label)).toHaveLength(2)
})

it('knows which notes mention a case', () => {
  const note = { blocks: [text('a', 'x'), { id: 'b', type: 'case', caseId: 'c1' }] }
  expect(mentionsCase(note, 'c1')).toBe(true)
  expect(mentionsCase(note, 'c2')).toBe(false)
})
