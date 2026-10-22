// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { buildTrail, getTrail, setTrailMission } from './api.js'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

it('loads my trail page with my token', async () => {
  const data = { trail: null, history: [], sources: { cases: 2, notes: 1 } }
  fetch.mockResolvedValue(Response.json(data))
  await expect(getTrail('t1')).resolves.toEqual(data)
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/trail')
  expect(init.headers).toEqual({ 'Accept-Language': 'en', Authorization: 'Bearer t1' })
})

it('builds a new trail with my date', async () => {
  const data = { trail: { id: 'tr1' }, history: [], sources: { cases: 2, notes: 1 } }
  fetch.mockResolvedValue(Response.json(data, { status: 201 }))
  await expect(buildTrail('2026-10-22', 't1')).resolves.toEqual(data)
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/trail')
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body)).toEqual({ today: '2026-10-22' })
})

it('ticks a mission with PUT and returns the updated trail', async () => {
  fetch.mockResolvedValue(Response.json({ trail: { id: 'tr1', doneCount: 1 } }))
  await expect(setTrailMission({ trailId: 'tr1', missionId: 'm6', done: true }, 't1')).resolves.toEqual({ id: 'tr1', doneCount: 1 })
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/trail')
  expect(init.method).toBe('PUT')
  expect(JSON.parse(init.body)).toEqual({ trailId: 'tr1', missionId: 'm6', done: true })
})
