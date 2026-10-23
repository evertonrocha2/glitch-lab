// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getPublicNote, listPublicNotes, searchProfiles, setNotePublic } from './api.js'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

it('shares a note with PATCH and my token', async () => {
  fetch.mockResolvedValue(Response.json({ note: { id: 'n1', isPublic: true } }))
  await expect(setNotePublic('n1', true, 't1')).resolves.toEqual({ id: 'n1', isPublic: true })
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/notes/n1')
  expect(init.method).toBe('PATCH')
  expect(init.headers.Authorization).toBe('Bearer t1')
  expect(JSON.parse(init.body)).toEqual({ isPublic: true })
})

it('lists public notes without a token', async () => {
  fetch.mockResolvedValue(Response.json({ notes: [{ id: 'n1' }] }))
  await expect(listPublicNotes('Ada Dev')).resolves.toEqual([{ id: 'n1' }])
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/profiles/Ada%20Dev/notes')
  expect(init.headers).toEqual({ 'Accept-Language': 'en' })
})

it('opens one public note with its author', async () => {
  const data = { note: { id: 'n 1' }, author: { handle: 'ada' } }
  fetch.mockResolvedValue(Response.json(data))
  await expect(getPublicNote('ada', 'n 1')).resolves.toEqual(data)
  expect(fetch.mock.calls[0][0]).toBe('/api/profiles/ada/notes/n%201')
})

it('returns null when a public note or list is not there', async () => {
  fetch.mockResolvedValue(Response.json({ message: 'No public note here.' }, { status: 404 }))
  await expect(getPublicNote('ada', 'n1')).resolves.toBeNull()
  fetch.mockResolvedValue(Response.json({ message: 'No public note here.' }, { status: 404 }))
  await expect(listPublicNotes('ada')).resolves.toBeNull()
})

it('searches public profiles', async () => {
  fetch.mockResolvedValue(Response.json({ profiles: [{ handle: 'ada' }] }))
  await expect(searchProfiles('ada lo')).resolves.toEqual([{ handle: 'ada' }])
  expect(fetch.mock.calls[0][0]).toBe('/api/profiles?search=ada%20lo')
})

it("shows the server's reason when a search is refused", async () => {
  fetch.mockResolvedValue(Response.json({ message: 'Search with letters.' }, { status: 400 }))
  await expect(searchProfiles('%')).rejects.toThrow('Search with letters.')
})
