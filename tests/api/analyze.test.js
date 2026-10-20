// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { POST } from '../../api/analyze.js'

const ANALYSIS = { explicacao: 'a', causa: 'b', correcao: 'c', exercicio: { enunciado: 'd', resposta: 'e' } }
const gemini = (text) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }))
const req = (body) =>
  new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
const sentPrompt = () => JSON.parse(fetch.mock.calls[0][1].body).contents[0].parts[0].text

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('returns the analysis when Gemini answers valid JSON', async () => {
  fetch.mockResolvedValue(gemini(JSON.stringify(ANALYSIS)))
  const res = await POST(req({ error: 'TypeError: x', code: 'x.y' }))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(ANALYSIS)
})

it('sends the key in a header, never in the URL', async () => {
  fetch.mockResolvedValue(gemini(JSON.stringify(ANALYSIS)))
  await POST(req({ error: 'TypeError: x', code: '' }))
  const [url, init] = fetch.mock.calls[0]
  expect(url).not.toContain('test-key')
  expect(init.headers['x-goog-api-key']).toBe('test-key')
})

it('keeps code indentation byte-for-byte', async () => {
  fetch.mockResolvedValue(gemini(JSON.stringify(ANALYSIS)))
  const code = 'def f():\n    return 1\n'
  await POST(req({ error: 'IndentationError', code }))
  expect(sentPrompt()).toContain(code)
})

it('works with an error and no code', async () => {
  fetch.mockResolvedValue(gemini(JSON.stringify(ANALYSIS)))
  const res = await POST(req({ error: 'IndexError: list index out of range' }))
  expect(res.status).toBe(200)
  expect(sentPrompt()).toContain('(no code provided)')
})

it('rejects an empty error', async () => {
  const res = await POST(req({ error: '   ' }))
  expect(res.status).toBe(400)
  expect(await res.json()).toEqual({ message: 'Paste an error message first.' })
  expect(fetch).not.toHaveBeenCalled()
})

it('rejects a body that is not JSON', async () => {
  const res = await POST(req('oops'))
  expect(res.status).toBe(400)
  expect(await res.json()).toEqual({ message: 'Invalid request.' })
})

it('rejects oversized input', async () => {
  const res = await POST(req({ error: 'TypeError: x', code: 'x'.repeat(6001) }))
  expect(res.status).toBe(413)
  expect(await res.json()).toEqual({
    message: 'Too long. Keep the error under 2000 characters and the code under 6000.',
  })
  expect(fetch).not.toHaveBeenCalled()
})

it('says the AI is busy when Gemini rate limits', async () => {
  fetch.mockResolvedValue(new Response('{}', { status: 429 }))
  const res = await POST(req({ error: 'TypeError: x' }))
  expect(res.status).toBe(429)
  expect(await res.json()).toEqual({ message: 'The AI is busy right now. Try again in a minute.' })
})

it('says the AI is busy when Gemini is overloaded', async () => {
  fetch.mockResolvedValue(new Response('{}', { status: 503 }))
  const res = await POST(req({ error: 'TypeError: x' }))
  expect(res.status).toBe(503)
  expect(await res.json()).toEqual({ message: 'The AI is busy right now. Try again in a minute.' })
})

it('uses gemini-3.8-flash when GEMINI_MODEL is not set', async () => {
  vi.stubEnv('GEMINI_MODEL', '')
  fetch.mockResolvedValue(gemini(JSON.stringify(ANALYSIS)))
  await POST(req({ error: 'TypeError: x' }))
  expect(fetch.mock.calls[0][0]).toContain('/models/gemini-3.8-flash:generateContent')
})

it('uses GEMINI_MODEL when it is set', async () => {
  vi.stubEnv('GEMINI_MODEL', 'some-model')
  fetch.mockResolvedValue(gemini(JSON.stringify(ANALYSIS)))
  await POST(req({ error: 'TypeError: x' }))
  expect(fetch.mock.calls[0][0]).toContain('/models/some-model:generateContent')
})

it('returns 502 when Gemini answers broken JSON', async () => {
  fetch.mockResolvedValue(gemini('not json'))
  const res = await POST(req({ error: 'TypeError: x' }))
  expect(res.status).toBe(502)
  expect(await res.json()).toEqual({ message: 'Something went wrong talking to the AI. Please try again.' })
})

it('returns 502 when a field is missing', async () => {
  fetch.mockResolvedValue(gemini(JSON.stringify({ ...ANALYSIS, exercicio: { enunciado: 'd' } })))
  const res = await POST(req({ error: 'TypeError: x' }))
  expect(res.status).toBe(502)
})

it('returns 502 when the network fails', async () => {
  fetch.mockRejectedValue(new Error('down'))
  const res = await POST(req({ error: 'TypeError: x' }))
  expect(res.status).toBe(502)
})

it('returns 500 when the API key is missing', async () => {
  vi.stubEnv('GEMINI_API_KEY', '')
  const res = await POST(req({ error: 'TypeError: x' }))
  expect(res.status).toBe(500)
  expect(await res.json()).toEqual({ message: 'Server is not configured.' })
})
