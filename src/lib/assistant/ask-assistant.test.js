// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { askAssistant } from '../api.js'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

it('asks the assistant with the conversation and the page', async () => {
  const answer = { reply: 'Hi', parts: [], actions: [], agents: ['guide'], steps: [] }
  fetch.mockResolvedValue(Response.json(answer))
  const body = { messages: [{ role: 'user', content: 'hi' }], page: { path: '/board' } }
  await expect(askAssistant(body, 'tok')).resolves.toEqual(answer)
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/assistant')
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body)).toEqual(body)
})
