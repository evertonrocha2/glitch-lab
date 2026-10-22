// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthError, addStudyTime, analyzeError, deleteNote, listCases, signIn, updateNote } from './api.js'

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
  expect(init.headers).toEqual({ 'Accept-Language': 'en', 'Content-Type': 'application/json', Authorization: 'Bearer dev:alice' })
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

it('signs in without sending a token', async () => {
  fetch.mockResolvedValue(Response.json({ token: 't1', user: { id: 'u1' } }))
  await expect(signIn({ email: 'ada@example.com', password: 'pw' })).resolves.toEqual({ token: 't1', user: { id: 'u1' } })
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/auth?action=login')
  expect(init.headers).toEqual({ 'Accept-Language': 'en', 'Content-Type': 'application/json' })
  expect(JSON.parse(init.body)).toEqual({ email: 'ada@example.com', password: 'pw' })
})

it('shows the wrong-password message from sign in', async () => {
  fetch.mockResolvedValue(Response.json({ message: 'Wrong email or password.' }, { status: 401 }))
  await expect(signIn({ email: 'ada@example.com', password: 'nope' })).rejects.toThrow('Wrong email or password.')
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

it('updates a note by id', async () => {
  fetch.mockResolvedValue(Response.json({ note: { id: 'n1', title: 'T' } }))
  await expect(updateNote('n1', { title: 'T', blocks: [] }, 'tok')).resolves.toEqual({ id: 'n1', title: 'T' })
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/notes')
  expect(init.method).toBe('PUT')
  expect(JSON.parse(init.body)).toEqual({ id: 'n1', title: 'T', blocks: [] })
})

it('deletes a note with its id in the query', async () => {
  fetch.mockResolvedValue(Response.json({ deleted: true }))
  await deleteNote('n 1', 'tok')
  expect(fetch.mock.calls[0][0]).toBe('/api/notes?id=n%201')
  expect(fetch.mock.calls[0][1].method).toBe('DELETE')
})

it('reports study time, with keepalive when the tab is closing', async () => {
  fetch.mockResolvedValue(Response.json({ todaySeconds: 120 }))
  await expect(addStudyTime({ seconds: 60, day: '2026-10-22' }, 'tok', { keepalive: true })).resolves.toBe(120)
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/progress')
  expect(init.keepalive).toBe(true)
  expect(JSON.parse(init.body)).toEqual({ seconds: 60, day: '2026-10-22' })
})
