// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GET } from '../../api/progress.js'
import { apiRequest, useTempStore } from './helpers.js'
import { CASE, challengeFor, SECRET } from './store-contract.js'

let store

beforeEach(async () => {
  store = await useTempStore()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T15:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const earned = (progress) => progress.badges.filter((badge) => badge.earned).map((badge) => badge.id)

it('builds my progress from my cases, gym, notes and study time', async () => {
  const kase = await store.createCase('alice', CASE)
  const challenge = await store.createChallenge('alice', challengeFor(kase.id), SECRET)
  await store.updateChallenge('alice', challenge.id, { status: 'passed' })
  await store.createNote('alice', { title: 'x', blocks: [{ id: 'b1', type: 'case', caseId: kase.id }] })
  await store.addStudyTime('alice', '2026-10-21', 600, 57_600)
  await store.addStudyTime('alice', '2026-10-22', 300, 57_600)
  await store.createCase('bob', CASE)

  const res = await GET(apiRequest('/api/progress?today=2026-10-22', { method: 'GET' }))
  expect(res.status).toBe(200)
  const { progress } = await res.json()
  expect(progress).toMatchObject({ xp: 10 + 30 + 15 + 5 + 15, streak: 2, todaySeconds: 300, totalSeconds: 900 })
  expect(earned(progress)).toEqual(['first-clue', 'fixed-it', 'sharp-eye', 'note-taker'])
})

it("falls back to the server's day when today is missing or wrong", async () => {
  await store.addStudyTime('alice', '2026-10-22', 300, 57_600)
  for (const query of ['', '?today=1999-01-01', '?today=nope']) {
    const { progress } = await (await GET(apiRequest(`/api/progress${query}`, { method: 'GET' }))).json()
    expect(progress.todaySeconds).toBe(300)
  }
})

it('asks for sign in', async () => {
  expect((await GET(apiRequest('/api/progress', { method: 'GET', token: null }))).status).toBe(401)
})
