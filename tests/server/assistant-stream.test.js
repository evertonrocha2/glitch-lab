// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSseParser } from '../../shared/sse.js'
import { api, geminiAnswer, streamed, useTempStore } from './helpers.js'
import { CASE } from './store-contract.js'

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

const body = (question, page = { path: '/board' }) => ({ messages: [{ role: 'user', content: question }], page })
const askStream = (question, page, options) => api('/api/assistant/stream', { body: body(question, page), ...options })
const askPlain = (question, page, options) => api('/api/assistant', { body: body(question, page), ...options })

async function eventsOf(res) {
  const events = []
  const parser = createSseParser(({ event, data }) => events.push({ event, data: JSON.parse(data) }))
  parser.push(await res.text())
  parser.end()
  return events
}

const systemOf = (init) => JSON.parse(init.body).systemInstruction.parts[0].text
const geminiChunks = (...texts) => streamed(texts.map((text) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\r\n\r\n`))

// The router answers JSON (generateContent); each specialist streams text (streamGenerateContent),
// or, on the plain endpoint, answers JSON. `answers[name]` is { text, chunks } per specialist.
function answerAs({ router, ...specialists }) {
  fetch.mockImplementation(async (url, init) => {
    const system = systemOf(init)
    if (system.startsWith('You route')) return router instanceof Response ? router : geminiAnswer(router)
    const who = Object.keys(specialists).find((name) => system.includes(`You are the ${name}`))
    const answer = specialists[who]
    if (answer instanceof Response || typeof answer === 'function') return typeof answer === 'function' ? answer() : answer
    if (!answer) return new Response('{}', { status: 500 })
    if (url.includes('streamGenerateContent')) return geminiChunks(...answer.chunks)
    return geminiAnswer(answer.json)
  })
}

it('streams steps, the text as it is written, and then the same payload as the plain endpoint', async () => {
  const kase = await store.createCase('alice', CASE)
  const action = { type: 'open_case', target: kase.id, label: 'Open it' }
  const reply = 'Your weak spot is reading undefined.\nCheck the value first.'
  answerAs({
    router: { specialists: [{ name: 'board', needs: ['case_list'] }] },
    'Board analyst': {
      chunks: ['Your weak spot is ', 'reading undefined.\nCheck the value first.\nAC', `TIONS: ${JSON.stringify([action])}`],
      json: { reply, actions: [action] },
    },
  })

  const res = await askStream('What is my weak spot?')
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toMatch(/^text\/event-stream/)
  expect(res.headers.get('cache-control')).toBe('no-cache, no-transform')
  expect(res.headers.get('x-accel-buffering')).toBe('no')

  const events = await eventsOf(res)
  expect(events.map((item) => item.event)).toEqual(['step', 'step', 'step', 'delta', 'delta', 'done'])
  expect(events.slice(0, 3).map((item) => item.data)).toEqual([
    { kind: 'routing', text: 'Routing your question' },
    { kind: 'specialists', agents: ['board'], text: 'Handing it to Board analyst' },
    { kind: 'context', agent: 'board', text: 'Board analyst is looking at your cases' },
  ])
  const deltas = events.filter((item) => item.event === 'delta').map((item) => item.data)
  expect(deltas.every((item) => item.agent === 'board')).toBe(true)
  expect(deltas.map((item) => item.text).join('')).toBe(`${reply}\n`)
  expect(JSON.stringify(deltas)).not.toContain('ACT')

  const done = events.at(-1).data
  const plain = await (await askPlain('What is my weak spot?')).json()
  expect(done).toEqual(plain)
  expect(done).toMatchObject({ reply, agents: ['board'], actions: [{ ...action, href: `/board?case=${kase.id}` }] })
  expect(await store.countUsage('alice', today())).toBe(2)
})

it('streams two specialists one after the other, each labeled, and counts the second before it writes', async () => {
  answerAs({
    router: { specialists: [{ name: 'guide', needs: [] }, { name: 'study', needs: [] }] },
    'App guide': { chunks: ['Press ', 'Alt+A.\nACTIONS: []'] },
    'Study planner': { chunks: ['Study ', '20 minutes.\nACTIONS: [{"type":"start_timer","target":"","label":""}]'] },
  })
  const events = await eventsOf(await askStream('How do I open you and plan my time?', { path: '/progress' }))
  const deltas = events.filter((item) => item.event === 'delta').map((item) => item.data)
  const firstStudy = deltas.findIndex((item) => item.agent === 'study')
  expect(firstStudy).toBeGreaterThan(0)
  expect(deltas.slice(0, firstStudy).every((item) => item.agent === 'guide')).toBe(true)
  expect(deltas.slice(firstStudy).every((item) => item.agent === 'study')).toBe(true)

  const done = events.at(-1)
  expect(done.event).toBe('done')
  expect(done.data.parts).toEqual([
    { agent: 'guide', reply: 'Press Alt+A.' },
    { agent: 'study', reply: 'Study 20 minutes.' },
  ])
  expect(done.data.actions).toEqual([{ type: 'start_timer', target: '', label: 'Start the study timer' }])
  expect(done.data.steps.at(-1)).toBe('Putting the answers together')
  expect(events.some((item) => item.event === 'step' && item.data.kind === 'merging')).toBe(true)
  expect(await store.countUsage('alice', today())).toBe(2)
})

it('skips the second specialist when the daily limit has room for one call only', async () => {
  for (let i = 0; i < 29; i++) await store.addUsage('alice', today())
  answerAs({
    router: { specialists: [{ name: 'guide', needs: [] }, { name: 'study', needs: [] }] },
    'App guide': { chunks: ['Press Alt+A.\nACTIONS: []'] },
    'Study planner': { chunks: ['never asked'] },
  })
  const events = await eventsOf(await askStream('How do I open you and plan my time?'))
  expect(events.at(-1).data.agents).toEqual(['guide'])
  expect(fetch.mock.calls.some(([, init]) => systemOf(init).includes('Study planner'))).toBe(false)
  expect(await store.countUsage('alice', today())).toBe(30)
})

it('answers a used-up daily limit and a bad request with plain JSON, before any stream or AI call', async () => {
  const broken = await api('/api/assistant/stream', { body: { messages: [] } })
  expect(broken.status).toBe(400)
  for (let i = 0; i < 30; i++) await store.addUsage('alice', today())
  const res = await askStream('What is my weak spot?')
  expect(res.status).toBe(429)
  expect(await res.json()).toEqual({ message: 'Daily limit reached. Come back tomorrow.' })
  const signedOut = await askStream('hi', undefined, { token: null })
  expect(signedOut.status).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
})

it('ends with an error event carrying the usual message when no specialist can answer', async () => {
  answerAs({ router: { specialists: [{ name: 'board', needs: [] }] }, 'Board analyst': () => new Response('{}', { status: 503 }) })
  const events = await eventsOf(await askStream('What is my weak spot?'))
  expect(events.map((item) => item.event)).toEqual(['step', 'step', 'step', 'step', 'error'])
  expect(events.at(-2).data).toEqual({ kind: 'failed', agent: 'board', text: 'Board analyst could not answer this time' })
  expect(events.at(-1).data).toEqual({ message: 'The AI is busy right now. Try again in a minute.' })
})

it('speaks Portuguese in the steps for a pt-BR reader', async () => {
  answerAs({ router: geminiAnswer('not json'), 'App guide': { chunks: ['Aqui você edita seu perfil.\nACTIONS: []'] } })
  const events = await eventsOf(await askStream('O que posso fazer aqui?', { path: '/profile' }, { locale: 'pt-BR' }))
  expect(events.filter((item) => item.event === 'step').map((item) => item.data.text)).toEqual([
    'Encaminhando sua pergunta',
    'Escolhendo especialistas por palavras-chave (o roteador não respondeu)',
    'Passando para Guia do app',
    'Guia do app está vendo como o app funciona',
  ])
  expect(events.at(-1).data.reply).toBe('Aqui você edita seu perfil.')
  const guide = fetch.mock.calls.find(([, init]) => systemOf(init).includes('App guide'))
  expect(guide[0]).toContain(':streamGenerateContent?alt=sse')
  expect(systemOf(guide[1])).toContain('ACTIONS:')
  expect(JSON.parse(guide[1].body).contents[0].parts[0].text).toContain('The student is on this page now. Your profile:')
})

it('stops the AI call when the student goes away', async () => {
  const { createServer, request } = await import('node:http')
  const { createApp } = await import('../../server/app.js')
  const { sessionFor } = await import('./helpers.js')
  let aborted
  const gone = new Promise((resolve) => (aborted = resolve))
  answerAs({
    router: { specialists: [{ name: 'board', needs: [] }] },
    // Writes nothing until it is aborted.
    'Board analyst': () => new Promise((_resolve, reject) => fetch.mock.lastCall[1].signal.addEventListener('abort', (event) => {
      aborted(true)
      reject(event.target.reason)
    })),
  })
  const server = createServer(createApp())
  await new Promise((resolve) => server.listen(0, resolve))
  try {
    const req = request({
      port: server.address().port,
      path: '/api/assistant/stream',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionFor('alice')}` },
    })
    req.on('response', (res) => res.once('data', () => setTimeout(() => req.destroy(), 50)))
    req.on('error', () => {})
    req.end(JSON.stringify(body('What is my weak spot?')))
    await expect(gone).resolves.toBe(true)
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
})
