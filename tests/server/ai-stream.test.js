// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AiError, streamText } from '../../server/infra/ai/index.js'
import { DEFAULT_MAX_TOKENS } from '../../server/infra/ai/openrouter.js'
import { neverAnswers, streamed } from './helpers.js'

const ARGS = { system: 'be nice', prompt: 'explain' }
const status = (code) => new Response('{}', { status: code })
const failure = (promise) => promise.then(() => null, (err) => err)
const orChunk = (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
const geminiChunk = (text) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\r\n\r\n`

beforeEach(() => {
  vi.stubEnv('AI_PROVIDER', 'openrouter,gemini')
  vi.stubEnv('OPENROUTER_API_KEY', 'or-key')
  vi.stubEnv('OPENROUTER_MODEL', '')
  vi.stubEnv('GEMINI_API_KEY', 'gemini-key')
  vi.stubEnv('AI_RETRY_DELAY_MS', '0')
  vi.stubGlobal('fetch', vi.fn())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('streams OpenRouter deltas as they come, skipping its processing comments, until [DONE]', async () => {
  fetch.mockResolvedValue(streamed([': OPENROUTER PROCESSING\n\n', orChunk('Hel'), `${orChunk('lo')}data: [DONE]\n\n`, orChunk('never')]))
  const deltas = []
  await expect(streamText({ ...ARGS, onDelta: (piece) => deltas.push(piece) })).resolves.toBe('Hello')
  expect(deltas).toEqual(['Hel', 'lo'])
  const [url, init] = fetch.mock.calls[0]
  expect(url).not.toContain('or-key')
  expect(init.headers.Authorization).toBe('Bearer or-key')
  const body = JSON.parse(init.body)
  expect(body.stream).toBe(true)
  expect(body.response_format).toBeUndefined()
  expect(body.max_tokens).toBe(DEFAULT_MAX_TOKENS)
})

it('streams Gemini with alt=sse, the key in a header, and leaves out thinking parts', async () => {
  vi.stubEnv('AI_PROVIDER', 'gemini')
  const thought = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'hmm', thought: true }] } }] })}\n\n`
  fetch.mockResolvedValue(streamed([thought, geminiChunk('Oi, '), geminiChunk('tudo bem?')]))
  const deltas = []
  await expect(streamText({ ...ARGS, onDelta: (piece) => deltas.push(piece) })).resolves.toBe('Oi, tudo bem?')
  expect(deltas).toEqual(['Oi, ', 'tudo bem?'])
  const [url, init] = fetch.mock.calls[0]
  expect(url).toMatch(/:streamGenerateContent\?alt=sse$/)
  expect(url).not.toContain('gemini-key')
  expect(init.headers['x-goog-api-key']).toBe('gemini-key')
})

it('falls back to the next provider when the first fails before streaming anything', async () => {
  fetch.mockResolvedValueOnce(status(402)).mockResolvedValueOnce(streamed([geminiChunk('from gemini')]))
  await expect(streamText({ ...ARGS, onDelta: () => {} })).resolves.toBe('from gemini')
  expect(fetch.mock.calls[1][0]).toContain('generativelanguage.googleapis.com')
})

it('falls back when the first provider sends an error chunk before any text', async () => {
  fetch
    .mockResolvedValueOnce(streamed([`data: ${JSON.stringify({ error: { message: 'no credits' } })}\n\n`]))
    .mockResolvedValueOnce(streamed([geminiChunk('ok')]))
  await expect(streamText({ ...ARGS, onDelta: () => {} })).resolves.toBe('ok')
})

it('does not fall back once text was streamed: a second model cannot finish the first one', async () => {
  fetch.mockResolvedValueOnce(streamed([orChunk('Half a sen'), new Error('connection reset')]))
  const deltas = []
  const err = await failure(streamText({ ...ARGS, onDelta: (piece) => deltas.push(piece) }))
  expect(err).toBeInstanceOf(AiError)
  expect(deltas).toEqual(['Half a sen'])
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('retries a fast busy answer once', async () => {
  fetch.mockResolvedValueOnce(status(429)).mockResolvedValueOnce(streamed([orChunk('second try')]))
  await expect(streamText({ ...ARGS, onDelta: () => {} })).resolves.toBe('second try')
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch.mock.calls[1][0]).toContain('openrouter.ai')
})

it('stops when the caller aborts, without trying the next provider', async () => {
  const controller = new AbortController()
  fetch.mockImplementation(neverAnswers())
  const pending = failure(streamText({ ...ARGS, onDelta: () => {}, signal: controller.signal }))
  controller.abort()
  expect(await pending).toBeInstanceOf(AiError)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('times out a stream that never answers', async () => {
  vi.stubEnv('AI_PROVIDER', 'openrouter')
  fetch.mockImplementation(neverAnswers())
  const err = await failure(streamText({ ...ARGS, onDelta: () => {}, timeoutMs: 20 }))
  expect(err.status).toBe(504)
})

it('fails when a provider streams no text at all', async () => {
  vi.stubEnv('AI_PROVIDER', 'openrouter')
  fetch.mockResolvedValue(streamed(['data: [DONE]\n\n']))
  const err = await failure(streamText({ ...ARGS, onDelta: () => {} }))
  expect(err.status).toBe(502)
})
