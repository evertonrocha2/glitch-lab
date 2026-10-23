// @vitest-environment node
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createLocalStore } from '../../server/infra/database/local/index.js'
import { DAILY_AI_LIMIT, DEFAULT_GLOBAL_AI_LIMIT, GLOBAL_AI_KEY, takeAiCall } from '../../server/infra/ai/quota.js'

const alice = { id: 'alice', email: 'alice@dev.local', isDemo: false }
const demo = { id: 'demo', email: 'demo@dev.local', isDemo: true }
const TODAY = new Date('2026-10-21T12:00:00Z')
const TOMORROW = new Date('2026-10-22T09:00:00Z')

afterEach(() => vi.unstubAllEnvs())

const freshStore = async () => createLocalStore({ file: join(await mkdtemp(join(tmpdir(), 'gd-usage-')), 'db.json') })

async function useUp(store, user, times, when) {
  for (let i = 0; i < times; i++) expect(await takeAiCall(store, user, when)).toBe(true)
}

it('allows 30 calls a day for a normal user', async () => {
  const store = await freshStore()
  expect(DAILY_AI_LIMIT.user).toBe(30)
  await useUp(store, alice, 30, TODAY)
  expect(await takeAiCall(store, alice, TODAY)).toBe(false)
  expect(await store.countUsage('alice', '2026-10-21')).toBe(30)
})

it('allows 20 for a demo account, since anyone can open one', async () => {
  const store = await freshStore()
  expect(DAILY_AI_LIMIT.demo).toBe(20)
  await useUp(store, demo, 20, TODAY)
  expect(await takeAiCall(store, demo, TODAY)).toBe(false)
})

it('stops every account once the global daily limit is used up', async () => {
  vi.stubEnv('AI_DAILY_GLOBAL_LIMIT', '3')
  const store = await freshStore()
  await useUp(store, alice, 2, TODAY)
  await useUp(store, demo, 1, TODAY)
  expect(await takeAiCall(store, { id: 'bob', isDemo: false }, TODAY)).toBe(false)
  expect(await store.countUsage('bob', '2026-10-21')).toBe(0)
  expect(await store.countUsage(GLOBAL_AI_KEY, '2026-10-21')).toBe(3)
  expect(await takeAiCall(store, alice, TOMORROW)).toBe(true)
})

it('has a sane global limit by default', () => {
  expect(DEFAULT_GLOBAL_AI_LIMIT).toBe(400)
})

it('starts over the next day', async () => {
  const store = await freshStore()
  await useUp(store, alice, 30, TODAY)
  expect(await takeAiCall(store, alice, TOMORROW)).toBe(true)
})
