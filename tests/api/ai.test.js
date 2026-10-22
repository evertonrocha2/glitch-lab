// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AiError, generateJson } from '../../api/_lib/ai/index.js'
import { neverAnswers } from './helpers.js'

const ARGS = { system: 'be nice', prompt: 'explain', schema: { type: 'OBJECT' } }
const gemini = (text) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }))
const status = (code) => new Response('{}', { status: code })
const failure = (promise) => promise.then(() => null, (err) => err)

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
  vi.stubEnv('AI_RETRY_DELAY_MS', '0')
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('parses the JSON text the provider returns', async () => {
  fetch.mockResolvedValue(gemini('{"a":1}'))
  await expect(generateJson(ARGS)).resolves.toEqual({ a: 1 })
})

it('sends the key in a header, never in the URL', async () => {
  fetch.mockResolvedValue(gemini('{}'))
  await generateJson(ARGS)
  const [url, init] = fetch.mock.calls[0]
  expect(url).not.toContain('test-key')
  expect(init.headers['x-goog-api-key']).toBe('test-key')
})

it('retries once when Gemini is busy and fails fast', async () => {
  fetch.mockResolvedValueOnce(status(503)).mockResolvedValueOnce(gemini('{"ok":true}'))
  await expect(generateJson(ARGS)).resolves.toEqual({ ok: true })
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('gives up after one retry', async () => {
  fetch.mockResolvedValueOnce(status(503)).mockResolvedValueOnce(status(503))
  const err = await failure(generateJson(ARGS))
  expect(err).toBeInstanceOf(AiError)
  expect(err.status).toBe(503)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('does not retry a slow busy answer', async () => {
  vi.stubEnv('AI_FAST_FAIL_MS', '0')
  fetch.mockResolvedValue(status(503))
  const err = await failure(generateJson(ARGS))
  expect(err.status).toBe(503)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('stops waiting after the time limit', async () => {
  vi.stubEnv('AI_TIMEOUT_MS', '20')
  fetch.mockImplementation(
    (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))),
  )
  const err = await failure(generateJson(ARGS))
  expect(err.status).toBe(504)
})

it('rejects text that is not JSON with 502', async () => {
  fetch.mockResolvedValue(gemini('not json'))
  const err = await failure(generateJson(ARGS))
  expect(err.status).toBe(502)
})

it('rejects an unknown provider with 500', async () => {
  vi.stubEnv('AI_PROVIDER', 'nope')
  const err = await failure(generateJson(ARGS))
  expect(err.status).toBe(500)
  expect(fetch).not.toHaveBeenCalled()
})

it('gives up at the custom time limit without a retry when asked', async () => {
  vi.stubGlobal('fetch', vi.fn(neverAnswers()))
  const started = Date.now()
  await expect(generateJson({ system: 's', prompt: 'p', schema: {}, timeoutMs: 50, retry: false })).rejects.toMatchObject({ status: 504 })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(Date.now() - started).toBeLessThan(2000)
})
