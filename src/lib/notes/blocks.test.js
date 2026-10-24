import { expect, it } from 'vitest'
import { duplicateBlock, emojiQueryAt, indentText, insertAfter, insertBefore, markdownShortcut, matchCases, matchSlash, mentionAt, mentionsCase, moveBlock, newBlock, outdentText, placeCase, removeBlock, slashQuery, updateBlock, wrapSelection } from './blocks.js'

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

it('finds a question card by its question, topic or title for an @mention', () => {
  const cases = [
    { id: '1', error: 'TypeError: x', concept: 'undefined-access', language: 'javascript' },
    { id: 'q', kind: 'question', error: '', question: 'Why does my loop skip?', topic: 'range end', title: 'range stops early', concept: 'off-by-one', language: 'python' },
  ]
  const label = () => 'Off by one'
  expect(matchCases(cases, 'skip', label).map((item) => item.id)).toEqual(['q'])
  expect(matchCases(cases, 'range end', label).map((item) => item.id)).toEqual(['q'])
  expect(matchCases(cases, 'stops early', label).map((item) => item.id)).toEqual(['q'])
})

it('turns markdown typed at the start of a line into blocks', () => {
  expect(markdownShortcut('## Title')).toEqual({ type: 'heading', fields: { level: 2, text: 'Title' } })
  expect(markdownShortcut('- item')).toEqual({ type: 'bullet', fields: { text: 'item' } })
  expect(markdownShortcut('1. step')).toEqual({ type: 'numbered', fields: { text: 'step' } })
  expect(markdownShortcut('[] do')).toEqual({ type: 'todo', fields: { text: 'do' } })
  expect(markdownShortcut('```ts ')).toEqual({ type: 'code', fields: { language: 'ts' } })
  expect(markdownShortcut('---')).toEqual({ type: 'divider', fields: {} })
  expect(markdownShortcut('#hashtag')).toBeNull()
  expect(markdownShortcut('text - not a list')).toBeNull()
})

it('finds the slash command, the emoji being typed and the matching menu items', () => {
  expect(slashQuery('/cod')).toBe('cod')
  expect(slashQuery('/')).toBe('')
  expect(slashQuery('a/b')).toBeNull()
  expect(slashQuery('/two words')).toBeNull()
  expect(emojiQueryAt('hot :fogo', 9)).toEqual({ start: 4, query: 'fogo' })
  expect(emojiQueryAt(':f', 2)).toBeNull()
  expect(emojiQueryAt('10:30', 5)).toBeNull()
  const label = (item) => item.key
  expect(matchSlash('codigo', label).map((item) => item.key)).toEqual(['code'])
  expect(matchSlash('CITAÇÃO', label).map((item) => item.key)).toEqual(['quote'])
  expect(matchSlash('', label)).toHaveLength(13)
})

it('moves, duplicates and inserts before', () => {
  const blocks = [text('a', '1'), text('b', '2')]
  expect(moveBlock(blocks, 'b', -1).map((block) => block.id)).toEqual(['b', 'a'])
  expect(moveBlock(blocks, 'a', -1)).toBe(blocks)
  const { blocks: copied, copyId } = duplicateBlock(blocks, 'a')
  expect(copied.map((block) => block.text)).toEqual(['1', '1', '2'])
  expect(copyId).not.toBe('a')
  expect(insertBefore(blocks, 'b', text('x', '')).map((block) => block.id)).toEqual(['a', 'x', 'b'])
})

it('wraps the selection in marks and indents prose', () => {
  expect(wrapSelection({ value: 'a word b', start: 2, end: 6 }, 'bold')).toEqual({ value: 'a **word** b', start: 4, end: 8 })
  expect(wrapSelection({ value: '', start: 0, end: 0 }, 'code')).toEqual({ value: '``', start: 1, end: 1 })
  expect(wrapSelection({ value: 'see', start: 0, end: 3 }, 'link')).toEqual({ value: '[see](https://)', start: 6, end: 14 })
  expect(indentText({ value: 'ab', start: 1, end: 1 })).toEqual({ value: 'a  b', start: 3, end: 3 })
  expect(outdentText({ value: '  ab', start: 3, end: 3 })).toEqual({ value: 'ab', start: 1, end: 1 })
  expect(outdentText({ value: 'ab', start: 1, end: 1 })).toBeNull()
})

it('builds the new kinds of block with their defaults', () => {
  expect(newBlock('code', { language: 'py' })).toMatchObject({ type: 'code', text: '', language: 'python' })
  expect(newBlock('callout')).toMatchObject({ type: 'callout', tone: 'tip', emoji: '💡' })
  expect(newBlock('heading', { level: 3 })).toMatchObject({ level: 3 })
  expect(newBlock('heading', { level: 1 })).not.toHaveProperty('level')
  expect(newBlock('bullet', { indent: 1 })).toMatchObject({ indent: 1 })
  expect(Object.keys(newBlock('divider'))).toEqual(['id', 'type'])
})
