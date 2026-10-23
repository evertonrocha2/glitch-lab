// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api, geminiAnswer, neverAnswers, useTempStore } from './helpers.js'

const ANALYSIS = { explicacao: 'a', causa: 'b', correcao: 'c', exercicio: { enunciado: 'd', resposta: 'e' } }
const AI_ANSWER = { ...ANALYSIS, concept: 'undefined-access', language: 'javascript' }
const BUSY = 'The AI is busy right now. Try again in a minute.'
const AI_FAILED = 'Something went wrong talking to the AI. Please try again.'

const analyze = (body, options) => api('/api/cases/analyze', { body, ...options })
const sentPrompt = () => JSON.parse(fetch.mock.calls[0][1].body).contents[0].parts[0].text

let store

beforeEach(async () => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
  vi.stubEnv('AI_RETRY_DELAY_MS', '0')
  vi.stubGlobal('fetch', vi.fn())
  store = await useTempStore()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('asks for sign in without a user', async () => {
  const res = await analyze({ error: 'TypeError: x' }, { token: null })
  expect(res.status).toBe(401)
  expect(await res.json()).toEqual({ message: 'Sign in to continue.' })
  expect(fetch).not.toHaveBeenCalled()
})

it('saves the investigation as a new case', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_ANSWER))
  const res = await analyze({ error: 'TypeError: x', code: 'x.y' })
  expect(res.status).toBe(201)
  const { case: saved } = await res.json()
  expect(saved).toMatchObject({
    userId: 'alice',
    error: 'TypeError: x',
    code: 'x.y',
    analysis: ANALYSIS,
    concept: 'undefined-access',
    language: 'javascript',
    status: 'new',
    passedCount: 0,
  })
  expect(await store.listCases('alice')).toHaveLength(1)
})

it('answers the same error sent again with the case it already made, with no AI call', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_ANSWER))
  const first = await (await analyze({ error: 'TypeError: x', code: 'x.y' })).json()
  const again = await analyze({ error: 'TypeError: x', code: 'x.y' })
  expect(again.status).toBe(201)
  expect((await again.json()).case.id).toBe(first.case.id)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(await store.listCases('alice')).toHaveLength(1)
  expect(await store.countUsage('alice', new Date().toISOString().slice(0, 10))).toBe(1)
})

it('still asks the AI when the code changed', async () => {
  fetch.mockImplementation(async () => geminiAnswer(AI_ANSWER))
  await analyze({ error: 'TypeError: x', code: 'x.y' })
  await analyze({ error: 'TypeError: x', code: 'x.z' })
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(await store.listCases('alice')).toHaveLength(2)
})

it('stops at the daily limit', async () => {
  for (let i = 0; i < 30; i++) await store.addUsage('alice', new Date().toISOString().slice(0, 10))
  const res = await analyze({ error: 'TypeError: x' })
  expect(res.status).toBe(429)
  expect(await res.json()).toEqual({ message: 'Daily limit reached. Come back tomorrow.' })
  expect(fetch).not.toHaveBeenCalled()
})

it('does not count a request that failed validation', async () => {
  await analyze({ error: '   ' })
  expect(await store.countUsage('alice', new Date().toISOString().slice(0, 10))).toBe(0)
})

it('keeps code indentation byte-for-byte', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_ANSWER))
  const code = 'def f():\n    return 1\n'
  await analyze({ error: 'IndentationError', code })
  expect(sentPrompt()).toContain(code)
})

it('works with an error and no code', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_ANSWER))
  const res = await analyze({ error: 'IndexError: list index out of range' })
  expect(res.status).toBe(201)
  expect(sentPrompt()).toContain('(no code provided)')
})

it('rejects an empty error', async () => {
  const res = await analyze({ error: '   ' })
  expect(res.status).toBe(400)
  expect(await res.json()).toEqual({ message: 'Paste an error message first.' })
  expect(fetch).not.toHaveBeenCalled()
})

it('rejects a body that is not JSON', async () => {
  const res = await analyze('oops')
  expect(res.status).toBe(400)
  expect(await res.json()).toEqual({ message: 'Invalid request.' })
})

it('rejects oversized input', async () => {
  const res = await analyze({ error: 'TypeError: x', code: 'x'.repeat(6001) })
  expect(res.status).toBe(413)
  expect(await res.json()).toEqual({
    message: 'Too long. Keep the error under 2000 characters and the code under 6000.',
  })
  expect(fetch).not.toHaveBeenCalled()
})

it('says the AI is busy when Gemini rate limits', async () => {
  fetch.mockResolvedValue(new Response('{}', { status: 429 }))
  const res = await analyze({ error: 'TypeError: x' })
  expect(res.status).toBe(429)
  expect(await res.json()).toEqual({ message: BUSY })
})

it('says the AI is busy when Gemini is overloaded', async () => {
  fetch.mockResolvedValue(new Response('{}', { status: 503 }))
  const res = await analyze({ error: 'TypeError: x' })
  expect(res.status).toBe(503)
  expect(await res.json()).toEqual({ message: BUSY })
})

it('says the AI took too long', async () => {
  vi.stubEnv('AI_TIMEOUT_MS', '20')
  fetch.mockImplementation(neverAnswers())
  const res = await analyze({ error: 'TypeError: x' })
  expect(res.status).toBe(504)
  expect(await res.json()).toEqual({ message: 'The AI took too long. Try again.' })
})

it('uses gemini-3.8-flash when GEMINI_MODEL is not set', async () => {
  vi.stubEnv('GEMINI_MODEL', '')
  fetch.mockResolvedValue(geminiAnswer(AI_ANSWER))
  await analyze({ error: 'TypeError: x' })
  expect(fetch.mock.calls[0][0]).toContain('/models/gemini-3.8-flash:generateContent')
})

it('uses GEMINI_MODEL when it is set', async () => {
  vi.stubEnv('GEMINI_MODEL', 'some-model')
  fetch.mockResolvedValue(geminiAnswer(AI_ANSWER))
  await analyze({ error: 'TypeError: x' })
  expect(fetch.mock.calls[0][0]).toContain('/models/some-model:generateContent')
})

it('returns 502 and saves nothing when Gemini answers broken JSON', async () => {
  fetch.mockResolvedValue(geminiAnswer('not json'))
  const res = await analyze({ error: 'TypeError: x' })
  expect(res.status).toBe(502)
  expect(await res.json()).toEqual({ message: AI_FAILED })
  expect(await store.listCases('alice')).toHaveLength(0)
})

it('returns 502 when a field is missing', async () => {
  fetch.mockResolvedValue(geminiAnswer({ ...AI_ANSWER, exercicio: { enunciado: 'd' } }))
  const res = await analyze({ error: 'TypeError: x' })
  expect(res.status).toBe(502)
})

it('returns 502 when the network fails', async () => {
  fetch.mockRejectedValue(new Error('down'))
  const res = await analyze({ error: 'TypeError: x' })
  expect(res.status).toBe(502)
})

it('returns 500 when the API key is missing', async () => {
  vi.stubEnv('GEMINI_API_KEY', '')
  const res = await analyze({ error: 'TypeError: x' })
  expect(res.status).toBe(500)
  expect(await res.json()).toEqual({ message: 'Server is not configured.' })
})

it('sends attached files, the context and the scanned spots to the AI, and keeps them on the case', async () => {
  fetch.mockResolvedValue(geminiAnswer({ ...AI_ANSWER, pistas: ['clue one', 'clue two'], local: 'cart.js, line 2' }))
  const files = [
    { path: 'shop/src/cart.js', content: 'const user = {}\nconsole.log(user.name.length)' },
    { path: 'shop/index.js', content: "require('./src/cart')" },
  ]
  const res = await analyze({
    error: "TypeError: Cannot read properties of undefined (reading 'length')\n    at Object.<anonymous> (/x/shop/src/cart.js:2:23)",
    files,
    context: 'Printing the name length',
  })
  expect(res.status).toBe(201)
  const prompt = sentPrompt()
  const [boundary] = prompt.match(/GLB-[0-9a-f]{16}/)
  expect(prompt).toContain(`<<<DATA file ${boundary}>>>\npath: shop/src/cart.js\nconst user = {}\nconsole.log(user.name.length)\n<<<END file ${boundary}>>>`)
  expect(prompt).toContain('Printing the name length')
  expect(prompt).toContain('/x/shop/src/cart.js line 2')
  const { case: saved } = await res.json()
  expect(saved.files).toEqual(files)
  expect(saved.context).toBe('Printing the name length')
  expect(saved.analysis.pistas).toEqual(['clue one', 'clue two'])
})

it('refuses broken or oversized attachments before calling the AI', async () => {
  const cases = [
    [{ error: 'E', files: 'nope' }, 400],
    [{ error: 'E', files: [{ path: 'a.js' }] }, 400],
    [{ error: 'E', files: Array.from({ length: 6 }, (_, i) => ({ path: `f${i}.js`, content: 'x' })) }, 413],
    [{ error: 'E', files: [{ path: 'a.js', content: 'x'.repeat(6001) }] }, 413],
    [{ error: 'E', files: [1, 2, 3].map((i) => ({ path: `f${i}.js`, content: 'x'.repeat(5500) })) }, 413],
    [{ error: 'E', context: 'x'.repeat(301) }, 413],
  ]
  for (const [body, status] of cases) expect((await analyze(body)).status).toBe(status)
  expect(fetch).not.toHaveBeenCalled()
})

it('asks the AI to write the explanation, clues and exercise in Portuguese for a pt-BR reader', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_ANSWER))
  await analyze({ error: 'TypeError: x' }, { locale: 'pt-BR' })
  const sent = JSON.parse(fetch.mock.calls[0][1].body)
  expect(sent.systemInstruction.parts[0].text).toMatch(/Brazilian Portuguese/)
  expect(sentPrompt()).toMatch(/Brazilian Portuguese/)
  expect(sentPrompt()).toMatch(/exactly as the programming language prints them/)
})

it('keeps the prompt in English without a Portuguese header', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_ANSWER))
  await analyze({ error: 'TypeError: x' })
  expect(sentPrompt()).toMatch(/plain, simple English/)
  expect(sentPrompt()).not.toMatch(/Portuguese/)
})
