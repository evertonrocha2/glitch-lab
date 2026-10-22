// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getDaily, getGlobalChallenge, startPuzzle } from './api.js'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

it("loads today's daily set", async () => {
  const body = { day: '2026-10-22', nextResetAt: '2026-10-23T03:00:00.000Z', streak: 1, puzzles: [] }
  fetch.mockResolvedValue(Response.json(body))
  await expect(getDaily('t1')).resolves.toEqual(body)
  expect(fetch.mock.calls[0][0]).toBe('/api/challenge?daily=1')
  expect(fetch.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer t1' })
})

it("loads this week's global challenge", async () => {
  const body = { week: '2026-10-19', puzzle: { id: 'p1' }, solvedCount: 0, leaderboard: [], you: null }
  fetch.mockResolvedValue(Response.json(body))
  await expect(getGlobalChallenge('t1')).resolves.toEqual(body)
  expect(fetch.mock.calls[0][0]).toBe('/api/challenge?global=1')
})

it('starts a puzzle and returns its challenge', async () => {
  fetch.mockResolvedValue(Response.json({ challenge: { id: 'ch9' } }, { status: 201 }))
  await expect(startPuzzle('p1', 't1')).resolves.toEqual({ id: 'ch9' })
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/challenge')
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body)).toEqual({ daily: true, puzzleId: 'p1' })
})
