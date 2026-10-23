// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { QUESTION_LIMITS } from '../../../shared/question.js'
import { createCaseFromQuestion, QUESTION_STREAM_URL, streamQuestion } from '../api.js'
import { atTurnCap, toApiMessages, turnsUsed } from './doubt-chat.js'

const CARD = { concept: 'off-by-one', topic: 'range end', language: 'python', title: 'range stops early', summary: 's', explanation: 'e', exercise: { prompt: 'p', answer: 'a' } }
const event = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

it('sends role and text, code on questions and the topic of a card shown, nothing else', () => {
  const messages = [
    { id: '1', role: 'user', content: 'Why?', code: 'x = 1' },
    { id: '2', role: 'assistant', content: 'Look at x.', card: CARD, cardState: 'dismissed', caseId: 'c1' },
    { id: '3', role: 'assistant', content: '', stopped: true },
    { id: '4', role: 'user', content: 'y'.repeat(QUESTION_LIMITS.message + 5) },
  ]
  expect(toApiMessages(messages)).toEqual([
    { role: 'user', content: 'Why?', code: 'x = 1' },
    { role: 'assistant', content: 'Look at x.', cardTopic: 'range end' },
    { role: 'user', content: 'y'.repeat(QUESTION_LIMITS.message) },
  ])
})

it('counts the questions asked and knows the cap', () => {
  const chat = Array.from({ length: QUESTION_LIMITS.turns }, (_, index) => ({ id: `${index}`, role: 'user', content: 'q' }))
  expect(turnsUsed(chat)).toBe(12)
  expect(atTurnCap(chat)).toBe(true)
  expect(atTurnCap(chat.slice(1))).toBe(false)
})

it('streams a tutor turn from its own endpoint and resolves with the card', async () => {
  const done = { reply: 'Hi', card: CARD, turns: 1, turnsLeft: 11 }
  fetch.mockResolvedValue(new Response(`${event('delta', { text: 'Hi' })}${event('done', done)}`, { headers: { 'Content-Type': 'text/event-stream' } }))
  const events = []
  await expect(streamQuestion({ messages: [{ role: 'user', content: 'Why?' }] }, 'tok', { onEvent: (item) => events.push(item) })).resolves.toEqual(done)
  expect(events).toEqual([{ type: 'delta', data: { text: 'Hi' } }])
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe(QUESTION_STREAM_URL)
  expect(url).toBe('/api/questions/stream')
  expect(init.headers).toMatchObject({ Accept: 'text/event-stream', Authorization: 'Bearer tok' })
  expect(JSON.parse(init.body)).toEqual({ messages: [{ role: 'user', content: 'Why?' }] })
})

it('turns the turn cap into the plain error it is, before any stream', async () => {
  fetch.mockResolvedValue(Response.json({ message: 'This chat reached its limit of 12 questions. Start a new chat to keep going.' }, { status: 409 }))
  await expect(streamQuestion({ messages: [] }, 'tok')).rejects.toThrow('This chat reached its limit of 12 questions.')
})

it('creates the card from the chat with POST /api/cases/from-question', async () => {
  fetch.mockResolvedValue(Response.json({ case: { id: 'q1', kind: 'question' } }, { status: 201 }))
  const messages = [{ role: 'user', content: 'Why?' }]
  await expect(createCaseFromQuestion({ messages, card: CARD }, 'tok')).resolves.toEqual({ id: 'q1', kind: 'question' })
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/cases/from-question')
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body)).toEqual({ messages, card: CARD })
})
