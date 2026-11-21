// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getWorld, saveWorldPosition } from './api.js'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const call = () => {
  const [url, init] = fetch.mock.calls[0]
  return { url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers.Authorization, keepalive: init.keepalive }
}

it('loads Glitch World', async () => {
  const data = { worlds: [], zones: {}, signals: {}, position: { world: 'laboratorio', x: 9, y: 7 } }
  fetch.mockResolvedValue(Response.json(data))
  await expect(getWorld('t1')).resolves.toEqual(data)
  expect(call()).toMatchObject({ url: '/api/world', method: 'GET', auth: 'Bearer t1' })
})

it("saves the hero's position, staying alive past the page when asked", async () => {
  fetch.mockResolvedValue(Response.json({ position: { world: 'floresta-js', x: 3, y: 10 } }))
  await expect(saveWorldPosition({ world: 'floresta-js', x: 3, y: 10 }, 't1', { keepalive: true })).resolves.toEqual({ world: 'floresta-js', x: 3, y: 10 })
  expect(call()).toMatchObject({ url: '/api/world/position', method: 'PUT', body: { world: 'floresta-js', x: 3, y: 10 }, keepalive: true })
})

it('does not keep a save alive by default', async () => {
  fetch.mockResolvedValue(Response.json({ position: { world: 'laboratorio', x: 9, y: 7 } }))
  await saveWorldPosition({ world: 'laboratorio', x: 9, y: 7 }, 't1')
  expect(call().keepalive).toBeFalsy()
})
