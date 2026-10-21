// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthError, analyzeError, listCases } from './api.js'

const CASE = { id: 'c1', status: 'new' }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

it('sends the token as a Bearer header', async () => {
  fetch.mockResolvedValue(Response.json({ case: CASE }, { status: 201 }))
  await analyzeError({ error: 'E', code: 'C' }, 'dev:alice')
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/analyze')
  expect(init.method).toBe('POST')
  expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer dev:alice' })
  expect(JSON.parse(init.body)).toEqual({ error: 'E', code: 'C' })
})

it('returns the saved case', async () => {
  fetch.mockResolvedValue(Response.json({ case: CASE }, { status: 201 }))
  await expect(analyzeError({ error: 'E', code: '' }, 'dev:alice')).resolves.toEqual(CASE)
})

it('lists cases', async () => {
  fetch.mockResolvedValue(Response.json({ cases: [CASE] }))
  await expect(listCases('dev:alice')).resolves.toEqual([CASE])
  expect(fetch.mock.calls[0][0]).toBe('/api/cases')
  expect(fetch.mock.calls[0][1].method).toBe('GET')
})

it('throws AuthError on 401', async () => {
  fetch.mockResolvedValue(Response.json({ message: 'Sign in to continue.' }, { status: 401 }))
  await expect(listCases('dev:alice')).rejects.toBeInstanceOf(AuthError)
})

it('throws the server message on failure', async () => {
  fetch.mockResolvedValue(Response.json({ message: 'The AI is busy right now. Try again in a minute.' }, { status: 429 }))
  await expect(analyzeError({ error: 'E', code: '' }, 'dev:alice')).rejects.toThrow(
    'The AI is busy right now. Try again in a minute.',
  )
})

it('throws a generic message when the body has no message', async () => {
  fetch.mockResolvedValue(new Response('oops', { status: 500 }))
  await expect(listCases('dev:alice')).rejects.toThrow('Something went wrong. Please try again.')
})

it('throws a connection message when the network fails', async () => {
  fetch.mockRejectedValue(new TypeError('Failed to fetch'))
  await expect(listCases('dev:alice')).rejects.toThrow('Could not reach the server. Check your connection.')
})
