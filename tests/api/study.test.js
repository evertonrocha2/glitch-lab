// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MAX_STUDY_SECONDS_PER_DAY } from '../../server/modules/progress/study.service.js'
import { POST } from '../../api/progress.js'
import { apiRequest, useTempStore } from './helpers.js'

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

const add = (body, token) => POST(apiRequest('/api/progress', { body, token }))

it("adds study time to the student's day", async () => {
  await add({ seconds: 60, day: '2026-10-22' })
  const res = await add({ seconds: 45, day: '2026-10-22' })
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ todaySeconds: 105 })
  expect(await store.listStudyTime('alice')).toEqual([{ day: '2026-10-22', seconds: 105 }])
})

it('accepts the day before or after (time zones)', async () => {
  expect((await add({ seconds: 10, day: '2026-10-21' })).status).toBe(200)
  expect((await add({ seconds: 10, day: '2026-10-23' })).status).toBe(200)
})

it('refuses a day far from today', async () => {
  expect((await add({ seconds: 10, day: '2026-10-01' })).status).toBe(400)
  expect((await add({ seconds: 10, day: 'today' })).status).toBe(400)
})

it('refuses odd amounts of time', async () => {
  for (const seconds of [0, -5, 1.5, 601, '60']) {
    expect((await add({ seconds, day: '2026-10-22' })).status).toBe(400)
  }
})

it('never counts more than the daily cap', async () => {
  vi.spyOn(store, 'addStudyTime')
  await add({ seconds: 60, day: '2026-10-22' })
  expect(store.addStudyTime).toHaveBeenCalledWith('alice', '2026-10-22', 60, MAX_STUDY_SECONDS_PER_DAY)
})

it('asks for sign in', async () => {
  expect((await add({ seconds: 60, day: '2026-10-22' }, null)).status).toBe(401)
})
