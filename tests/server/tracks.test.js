// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api, useTempStore } from './helpers.js'

beforeEach(async () => {
  await useTempStore()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-03T15:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const put = (id, body, token) => api(`/api/tracks/${id}`, { method: 'PUT', body, token })

it('adds a track with an exam date and lists it', async () => {
  const res = await put('enem', { examDate: '2027-11-07' })
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ track: { id: 'enem', examDate: '2027-11-07', createdAt: expect.any(String) } })
  const list = await api('/api/tracks', { method: 'GET' })
  expect((await list.json()).tracks).toEqual([expect.objectContaining({ id: 'enem', examDate: '2027-11-07' })])
})

it('adds a track without a date, and changes the date later', async () => {
  expect((await (await put('enem', {})).json()).track.examDate).toBeNull()
  expect((await (await put('enem', { examDate: '2026-11-03' })).json()).track.examDate).toBe('2026-11-03')
  expect((await (await put('enem', { examDate: null })).json()).track.examDate).toBeNull()
})

it('refuses odd exam dates', async () => {
  for (const examDate of ['2026-10-01', '2031-01-01', 'amanhã', 20271107, '2027-02-30']) {
    const res = await put('enem', { examDate })
    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe('Pick an exam date from today up to 3 years ahead.')
  }
})

it('refuses a date on a track with no exam', async () => {
  const res = await put('programming', { examDate: '2027-01-01' })
  expect(res.status).toBe(400)
  expect((await res.json()).message).toBe('This track has no exam date.')
  expect((await put('programming', {})).status).toBe(200)
})

it('refuses unknown tracks', async () => {
  for (const id of ['esa', '__proto__']) {
    const res = await put(id, {})
    expect(res.status).toBe(404)
    expect((await res.json()).message).toBe('Track not found.')
  }
})

it('removes a track', async () => {
  await put('enem', {})
  expect(await (await api('/api/tracks/enem', { method: 'DELETE' })).json()).toEqual({ deleted: true })
  const again = await api('/api/tracks/enem', { method: 'DELETE' })
  expect(again.status).toBe(404)
  expect((await again.json()).message).toBe('Track not found.')
})

it("keeps each student's tracks apart", async () => {
  await put('enem', {}, 'dev:alice')
  expect((await (await api('/api/tracks', { method: 'GET', token: 'dev:bob' })).json()).tracks).toEqual([])
})

it('asks for sign in', async () => {
  expect((await api('/api/tracks', { method: 'GET', token: null })).status).toBe(401)
  expect((await put('enem', {}, null)).status).toBe(401)
  expect((await api('/api/tracks/enem', { method: 'DELETE', token: null })).status).toBe(401)
})
