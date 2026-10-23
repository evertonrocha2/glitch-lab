import { expect, it } from 'vitest'
import { loadConversation, pageFromLocation, parseInline, parseReply, saveConversation, toApiMessages } from './conversation.js'

it('keeps each conversation per user in session storage', () => {
  saveConversation('alice', [{ id: 'm1', role: 'user', content: 'hi' }])
  expect(loadConversation('alice')).toEqual([{ id: 'm1', role: 'user', content: 'hi' }])
  expect(loadConversation('bob')).toEqual([])
  sessionStorage.setItem('gd:assistant:carol', 'not json')
  expect(loadConversation('carol')).toEqual([])
})

it('sends the API only roles and text, the last 12, each under the limit', () => {
  const messages = Array.from({ length: 14 }, (_, i) => ({ id: `m${i}`, role: i % 2 ? 'assistant' : 'user', content: `m${i}`, actions: [] }))
  messages.push({ id: 'long', role: 'user', content: 'x'.repeat(2500) })
  const sent = toApiMessages(messages)
  expect(sent).toHaveLength(12)
  expect(sent[0]).toEqual({ role: 'assistant', content: 'm3' })
  expect(sent.at(-1).content).toHaveLength(2000)
})

it('describes the page for the API', () => {
  expect(pageFromLocation('/board', null)).toEqual({ path: '/board' })
  expect(pageFromLocation('/board', { caseId: 'c1' })).toEqual({ path: '/board', caseId: 'c1' })
  expect(pageFromLocation('/gym/ch1', null)).toEqual({ path: '/gym/ch1', challengeId: 'ch1' })
  expect(pageFromLocation('/notes/n1', null)).toEqual({ path: '/notes/n1', noteId: 'n1' })
  expect(pageFromLocation('/notes', null)).toEqual({ path: '/notes' })
  expect(pageFromLocation('/interrogate/c7', null)).toEqual({ path: '/interrogate/c7', caseId: 'c7' })
})

it('splits a reply into paragraphs, lists and code blocks', () => {
  const reply = 'First line\nsame paragraph\n\n- one\n- two\n\n```js\nconst a = 1\n\nconsole.log(a)\n```\nLast'
  expect(parseReply(reply)).toEqual([
    { type: 'paragraph', text: 'First line\nsame paragraph' },
    { type: 'list', items: ['one', 'two'] },
    { type: 'code', text: 'const a = 1\n\nconsole.log(a)' },
    { type: 'paragraph', text: 'Last' },
  ])
})

it('keeps an unclosed code block as code', () => {
  expect(parseReply('```\nx = 1')).toEqual([{ type: 'code', text: 'x = 1' }])
})

it('finds inline code and bold text', () => {
  expect(parseInline('Check `user.name` before **reading** it')).toEqual([
    { type: 'text', text: 'Check ' },
    { type: 'code', text: 'user.name' },
    { type: 'text', text: ' before ' },
    { type: 'strong', text: 'reading' },
    { type: 'text', text: ' it' },
  ])
})
