// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AiError, generateJson } from '../../server/infra/ai/index.js'
import { DEFAULT_OPENROUTER_MODEL, toJsonSchema } from '../../server/infra/ai/openrouter.js'

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    tags: { type: 'ARRAY', items: { type: 'STRING', enum: ['a', 'b'] } },
    steps: { type: 'ARRAY', items: { type: 'OBJECT', properties: { n: { type: 'INTEGER' } }, required: ['n'] } },
  },
  required: ['title'],
  propertyOrdering: ['title', 'tags', 'steps'],
}
const ARGS = { system: 'be nice', prompt: 'explain', schema: SCHEMA }
const openrouter = (content) => new Response(JSON.stringify({ choices: [{ message: { content } }] }))
const gemini = (text) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }))
const status = (code) => new Response('{}', { status: code })
const failure = (promise) => promise.then(() => null, (err) => err)

beforeEach(() => {
  vi.stubEnv('AI_PROVIDER', 'openrouter')
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

it('turns the Gemini-style schema into closed, lowercase JSON Schema', () => {
  expect(toJsonSchema(SCHEMA)).toEqual({
    type: 'object',
    properties: {
      title: { type: 'string' },
      tags: { type: 'array', items: { type: 'string', enum: ['a', 'b'] } },
      steps: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' } }, required: ['n'], additionalProperties: false } },
    },
    required: ['title'],
    additionalProperties: false,
  })
})

it('asks OpenRouter for schema-shaped JSON with the key in a header', async () => {
  fetch.mockResolvedValue(openrouter('{"title":"ok"}'))
  await expect(generateJson(ARGS)).resolves.toEqual({ title: 'ok' })
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
  expect(url).not.toContain('or-key')
  expect(init.headers.Authorization).toBe('Bearer or-key')
  const body = JSON.parse(init.body)
  expect(body.model).toBe(DEFAULT_OPENROUTER_MODEL)
  expect(body.messages).toEqual([
    { role: 'system', content: 'be nice' },
    { role: 'user', content: 'explain' },
  ])
  expect(body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: toJsonSchema(SCHEMA) } })
})

it('uses OPENROUTER_MODEL when set', async () => {
  vi.stubEnv('OPENROUTER_MODEL', 'openai/some-model')
  fetch.mockResolvedValue(openrouter('{}'))
  await generateJson(ARGS)
  expect(JSON.parse(fetch.mock.calls[0][1].body).model).toBe('openai/some-model')
})

it('reads JSON wrapped in a code fence', async () => {
  fetch.mockResolvedValue(openrouter('```json\n{"title":"fenced"}\n```'))
  await expect(generateJson(ARGS)).resolves.toEqual({ title: 'fenced' })
})

it('treats a refused key or no credits as a setup problem', async () => {
  fetch.mockResolvedValue(status(402))
  const err = await failure(generateJson(ARGS))
  expect(err).toBeInstanceOf(AiError)
  expect(err.status).toBe(500)
})

it('fails without a key, before any request', async () => {
  vi.stubEnv('OPENROUTER_API_KEY', '')
  const err = await failure(generateJson(ARGS))
  expect(err.status).toBe(500)
  expect(fetch).not.toHaveBeenCalled()
})

it('falls back to the next provider in the chain when the first one fails', async () => {
  vi.stubEnv('AI_PROVIDER', 'openrouter,gemini')
  fetch.mockResolvedValueOnce(status(500)).mockResolvedValueOnce(gemini('{"title":"from gemini"}'))
  await expect(generateJson(ARGS)).resolves.toEqual({ title: 'from gemini' })
  expect(fetch.mock.calls[1][0]).toContain('generativelanguage.googleapis.com')
})

it('answers with the last error when every provider fails', async () => {
  vi.stubEnv('AI_PROVIDER', 'openrouter,gemini')
  fetch.mockResolvedValueOnce(status(500)).mockResolvedValueOnce(status(400))
  const err = await failure(generateJson(ARGS))
  expect(err.status).toBe(400)
})

it('refuses an unknown provider in the chain', async () => {
  vi.stubEnv('AI_PROVIDER', 'openrouter,nope')
  const err = await failure(generateJson(ARGS))
  expect(err.status).toBe(500)
  expect(fetch).not.toHaveBeenCalled()
})
