// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSseParser } from '../../shared/sse.js'
import { api, streamed, useTempStore } from './helpers.js'
import { CARD } from './question-fixtures.js'

const today = () => new Date().toISOString().slice(0, 10)

let store

beforeEach(async () => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
  vi.stubEnv('AI_RETRY_DELAY_MS', '0')
  vi.stubGlobal('fetch', vi.fn())
  vi.spyOn(console, 'error').mockImplementation(() => {})
  store = await useTempStore()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const user = (content, extra = {}) => ({ role: 'user', content, ...extra })
const tutor = (content, extra = {}) => ({ role: 'assistant', content, ...extra })
const ask = (messages, options) => api('/api/questions/stream', { body: { messages }, ...options })
const geminiChunks = (...texts) => streamed(texts.map((text) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\r\n\r\n`))
const systemOf = (init) => JSON.parse(init.body).systemInstruction.parts[0].text
const promptOf = (init) => JSON.parse(init.body).contents[0].parts[0].text

async function eventsOf(res) {
  const events = []
  const parser = createSseParser(({ event, data }) => events.push({ event, data: JSON.parse(data) }))
  parser.push(await res.text())
  parser.end()
  return events
}

it('streams the tutor turn, holds the CARD line back and sends the checked card in done', async () => {
  fetch.mockImplementation(async () => geminiChunks('The end of a range — is left out.\n', 'What does range(3) give?\nCA', `RD: ${JSON.stringify(CARD)}`))
  const res = await ask([user('Why does my loop skip the last item?', { code: 'for i in range(len(xs) - 1):\n    print(xs[i])' })])
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toMatch(/^text\/event-stream/)

  const events = await eventsOf(res)
  expect(events.at(-1).event).toBe('done')
  const deltas = events.filter((item) => item.event === 'delta').map((item) => item.data.text)
  expect(deltas.join('')).toBe('The end of a range, is left out.\nWhat does range(3) give?\n')
  expect(JSON.stringify(deltas)).not.toContain('CARD')
  expect(events.at(-1).data).toEqual({ reply: 'The end of a range, is left out.\nWhat does range(3) give?', card: CARD, turns: 1, turnsLeft: 11 })

  const [url, init] = fetch.mock.calls[0]
  expect(url).toContain('streamGenerateContent')
  expect(systemOf(init)).toContain('You are the Tutor')
  expect(promptOf(init)).toContain('<student_code>')
  expect(await store.countUsage('alice', today())).toBe(1)
  expect(await store.countUsage('ai:all', today())).toBe(1)
})

it('answers in Portuguese for a pt-BR reader and sends no card while the tutor is unsure', async () => {
  fetch.mockImplementation(async () => geminiChunks('Me conta: o que você esperava ver?'))
  const events = await eventsOf(await ask([user('Não entendi meu loop')], { locale: 'pt-BR' }))
  expect(events.at(-1).data).toMatchObject({ reply: 'Me conta: o que você esperava ver?', card: null })
  expect(systemOf(fetch.mock.calls[0][1])).toContain('Brazilian Portuguese')
})

it('drops a card that fails the checks but keeps the answer', async () => {
  fetch.mockImplementation(async () => geminiChunks(`Good question.\nCARD: ${JSON.stringify({ ...CARD, concept: 'loops' })}`))
  const events = await eventsOf(await ask([user('Why?')]))
  expect(events.at(-1).data).toMatchObject({ reply: 'Good question.', card: null })
})

it('sends an error event when the AI fails mid-turn', async () => {
  fetch.mockResolvedValue(new Response('{}', { status: 500 }))
  const events = await eventsOf(await ask([user('Why?')]))
  expect(events.at(-1).event).toBe('error')
  expect(events.at(-1).data.message).toEqual(expect.any(String))
})

it('refuses before any stream: bad turns, the turn cap and the daily limit, without an AI call', async () => {
  const bad = await ask([user('Why?'), tutor('Because.')])
  expect(bad.status).toBe(400)
  expect(bad.headers.get('content-type')).toMatch(/json/)

  const long = Array.from({ length: 13 }, (_, index) => [user(`Q${index}`), tutor('A')]).flat().slice(0, -1)
  const capped = await ask(long)
  expect(capped.status).toBe(409)
  expect((await capped.json()).message).toBe('This chat reached its limit of 12 questions. Start a new chat to keep going.')

  for (let i = 0; i < 30; i++) await store.addUsage('alice', today())
  const limited = await ask([user('Why?')])
  expect(limited.status).toBe(429)
  expect((await limited.json()).message).toBe('Daily limit reached. Come back tomorrow.')
  expect(fetch).not.toHaveBeenCalled()
})

it('stops at the global daily cap too', async () => {
  vi.stubEnv('AI_DAILY_GLOBAL_LIMIT', '2')
  await store.addUsage('ai:all', today())
  await store.addUsage('ai:all', today())
  const res = await ask([user('Why?')])
  expect(res.status).toBe(429)
  expect(fetch).not.toHaveBeenCalled()
})

it('needs a session', async () => {
  expect((await ask([user('Why?')], { token: null })).status).toBe(401)
})

const create = (body, options) => api('/api/cases/from-question', { body, ...options })
const chat = [user('Why does my loop skip the last item?', { code: 'for i in range(len(xs) - 1):\n    print(xs[i])' }), tutor('What does range(3) give?', { cardTopic: 'range end' })]

it('creates a question card from the chat and the card, with no AI call', async () => {
  const res = await create({ messages: chat, card: CARD })
  expect(res.status).toBe(201)
  const { case: made } = await res.json()
  expect(made).toMatchObject({
    kind: 'question',
    error: '',
    question: 'Why does my loop skip the last item?',
    code: 'for i in range(len(xs) - 1):\n    print(xs[i])',
    topic: 'range end',
    title: 'range stops before its end',
    recap: CARD.recap,
    concept: 'off-by-one',
    language: 'python',
    status: 'new',
    analysis: { explicacao: CARD.summary, causa: CARD.explanation, correcao: '', exercicio: { enunciado: CARD.exercise.prompt, resposta: CARD.exercise.answer } },
  })
  expect(made).not.toHaveProperty('messages')
  expect(fetch).not.toHaveBeenCalled()
  expect(await store.countUsage('alice', today())).toBe(0)
  expect((await (await api('/api/cases', { method: 'GET' })).json()).cases.map((item) => item.id)).toEqual([made.id])
})

it('gives the same card sent again within 10 minutes back, and a new one later', async () => {
  const first = (await (await create({ messages: chat, card: CARD })).json()).case
  const again = await create({ messages: chat, card: CARD })
  expect(again.status).toBe(200)
  expect((await again.json()).case.id).toBe(first.id)
  const other = await create({ messages: chat, card: { ...CARD, topic: 'range start' } })
  expect(other.status).toBe(201)

  vi.useFakeTimers({ now: Date.now() + 11 * 60 * 1000, toFake: ['Date'] })
  try {
    const later = await create({ messages: chat, card: CARD })
    expect(later.status).toBe(201)
    expect((await later.json()).case.id).not.toBe(first.id)
  } finally {
    vi.useRealTimers()
  }
})

it('builds a short recap from the questions when the card has none, and stores language null as unknown', async () => {
  const { recap, ...card } = CARD
  const messages = [user('What is a closure?\nI read about it'), tutor('A function that remembers.'), user('So it keeps variables?')]
  const made = (await (await create({ messages, card: { ...card, language: null, concept: 'other' } })).json()).case
  expect(made).toMatchObject({ recap: 'What is a closure?\nSo it keeps variables?', language: 'unknown', concept: 'other', code: '' })
})

it('refuses a broken card or chat, in Portuguese too', async () => {
  const broken = await create({ messages: chat, card: { ...CARD, summary: '' } })
  expect(broken.status).toBe(400)
  expect((await broken.json()).message).toBe('This card is incomplete. Keep chatting so the tutor can propose a new one.')
  const pt = await create({ messages: chat, card: { ...CARD, concept: 'nope' } }, { locale: 'pt-BR' })
  expect((await pt.json()).message).toBe('This card is incomplete. Keep chatting so the tutor can propose a new one.')
  expect((await create({ messages: [tutor('Hi')], card: CARD })).status).toBe(400)
  expect((await create({ card: CARD })).status).toBe(400)
  expect((await create({ messages: chat, card: CARD }, { token: null })).status).toBe(401)
  expect(await store.listCases('alice')).toEqual([])
})
