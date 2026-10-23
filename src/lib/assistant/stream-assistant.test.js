// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthError, ASSISTANT_STREAM_URL, StreamUnavailableError, streamAssistant } from '../api.js'

const BODY = { messages: [{ role: 'user', content: 'hi' }], page: { path: '/board' } }
const DONE = { reply: 'Hi there', parts: [{ agent: 'guide', reply: 'Hi there' }], actions: [], agents: ['guide'], steps: ['Routing your question'] }
const event = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`
const failure = (promise) => promise.then(() => null, (err) => err)

// A text/event-stream response whose body arrives in these chunks; an Error breaks it there.
function sse(chunks, headers = { 'Content-Type': 'text/event-stream; charset=utf-8' }) {
  const queue = [...chunks]
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      pull(controller) {
        const next = queue.shift()
        if (next === undefined) controller.close()
        else if (next instanceof Error) controller.error(next)
        else controller.enqueue(encoder.encode(next))
      },
    }),
    { headers },
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

it('posts to the stream with the token, reads steps and deltas split anywhere, and resolves with done', async () => {
  const text = `: open\n\n${event('step', { kind: 'routing', text: 'Routing your question' })}${event('delta', { agent: 'guide', text: 'Hi ' })}${event('delta', { agent: 'guide', text: 'there' })}${event('done', DONE)}`
  fetch.mockResolvedValue(sse([text.slice(0, 7), text.slice(7, 60), text.slice(60, 61), text.slice(61)]))
  const events = []
  await expect(streamAssistant(BODY, 'tok', { onEvent: (item) => events.push(item) })).resolves.toEqual(DONE)
  expect(events).toEqual([
    { type: 'step', data: { kind: 'routing', text: 'Routing your question' } },
    { type: 'delta', data: { agent: 'guide', text: 'Hi ' } },
    { type: 'delta', data: { agent: 'guide', text: 'there' } },
  ])
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe(ASSISTANT_STREAM_URL)
  expect(url).toBe('/api/assistant/stream')
  expect(init.method).toBe('POST')
  expect(init.headers).toMatchObject({ Accept: 'text/event-stream', Authorization: 'Bearer tok', 'Accept-Language': 'en' })
  expect(JSON.parse(init.body)).toEqual(BODY)
})

it('throws the server message from an error event, which is not a reason to ask again', async () => {
  fetch.mockResolvedValue(sse([event('step', { text: 'x' }), event('error', { message: 'The AI is busy right now. Try again in a minute.' })]))
  const err = await failure(streamAssistant(BODY, 'tok'))
  expect(err).not.toBeInstanceOf(StreamUnavailableError)
  expect(err.message).toBe('The AI is busy right now. Try again in a minute.')
})

it('passes on the API own JSON errors, and signs out on 401', async () => {
  fetch.mockResolvedValueOnce(Response.json({ message: 'Daily limit reached. Come back tomorrow.' }, { status: 429 }))
  const limit = await failure(streamAssistant(BODY, 'tok'))
  expect(limit).not.toBeInstanceOf(StreamUnavailableError)
  expect(limit.message).toBe('Daily limit reached. Come back tomorrow.')
  fetch.mockResolvedValueOnce(Response.json({ message: 'Sign in to continue.' }, { status: 401 }))
  expect(await failure(streamAssistant(BODY, 'tok'))).toBeInstanceOf(AuthError)
})

it('says the stream is unavailable when a proxy answers with something else, or the network fails', async () => {
  fetch.mockResolvedValueOnce(new Response('<html>Gateway</html>', { status: 504, headers: { 'Content-Type': 'text/html' } }))
  expect(await failure(streamAssistant(BODY, 'tok'))).toBeInstanceOf(StreamUnavailableError)
  fetch.mockResolvedValueOnce(Response.json({ reply: 'buffered as JSON' }))
  expect(await failure(streamAssistant(BODY, 'tok'))).toBeInstanceOf(StreamUnavailableError)
  fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  expect(await failure(streamAssistant(BODY, 'tok'))).toBeInstanceOf(StreamUnavailableError)
})

it('is unavailable when cut before any text, but a plain error once text was shown', async () => {
  fetch.mockResolvedValueOnce(sse([event('step', { text: 'Routing your question' }), new Error('reset')]))
  expect(await failure(streamAssistant(BODY, 'tok'))).toBeInstanceOf(StreamUnavailableError)
  fetch.mockResolvedValueOnce(sse([event('delta', { agent: 'guide', text: 'Half' })]))
  const cut = await failure(streamAssistant(BODY, 'tok'))
  expect(cut).toBeInstanceOf(Error)
  expect(cut).not.toBeInstanceOf(StreamUnavailableError)
})

it('rejects with the abort when the signal fires', async () => {
  const controller = new AbortController()
  fetch.mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))))
  const pending = failure(streamAssistant(BODY, 'tok', { signal: controller.signal }))
  controller.abort()
  const err = await pending
  expect(err.name).toBe('AbortError')
  expect(err).not.toBeInstanceOf(StreamUnavailableError)
})
