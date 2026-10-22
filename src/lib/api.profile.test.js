// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getMyProfile, getPublicProfile, saveProfile } from './api.js'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

it('loads my profile with my token', async () => {
  const data = { profile: { handle: null }, earnedBadges: [], progress: { level: 1 } }
  fetch.mockResolvedValue(Response.json(data))
  await expect(getMyProfile('2026-10-22', 't1')).resolves.toEqual(data)
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/profile?today=2026-10-22')
  expect(init.headers).toEqual({ 'Accept-Language': 'en', Authorization: 'Bearer t1' })
})

it('saves profile changes with PUT', async () => {
  fetch.mockResolvedValue(Response.json({ profile: { handle: 'ada' } }))
  await expect(saveProfile({ handle: 'ada' }, 't1')).resolves.toEqual({ handle: 'ada' })
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/profile')
  expect(init.method).toBe('PUT')
  expect(JSON.parse(init.body)).toEqual({ handle: 'ada' })
})

it('shows the server message when a handle is taken', async () => {
  fetch.mockResolvedValue(Response.json({ message: 'That handle is taken. Try another one.' }, { status: 409 }))
  await expect(saveProfile({ handle: 'ada' }, 't1')).rejects.toThrow('That handle is taken. Try another one.')
})

it('loads a public profile without a token', async () => {
  fetch.mockResolvedValue(Response.json({ profile: { handle: 'ada' } }))
  await expect(getPublicProfile('Ada Dev', '2026-10-22')).resolves.toEqual({ profile: { handle: 'ada' }, preview: false })
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/profile?handle=Ada%20Dev&today=2026-10-22')
  expect(init.headers).toEqual({ 'Accept-Language': 'en' })
})

it('returns null for a profile that is missing or private', async () => {
  fetch.mockResolvedValue(Response.json({ message: 'No public profile here.' }, { status: 404 }))
  await expect(getPublicProfile('ghost', '2026-10-22')).resolves.toBeNull()
})

it('still throws on other public profile errors', async () => {
  fetch.mockResolvedValue(Response.json({ message: 'Server error.' }, { status: 500 }))
  await expect(getPublicProfile('ada', '2026-10-22')).rejects.toThrow('Server error.')
})
