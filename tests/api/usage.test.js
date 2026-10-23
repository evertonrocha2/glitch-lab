// @vitest-environment node
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { createLocalStore } from '../../server/infra/database/local/index.js'
import { DAILY_AI_LIMIT, takeAiCall } from '../../server/infra/ai/quota.js'

const alice = { id: 'alice', email: 'alice@dev.local', isDemo: false }
const demo = { id: 'demo', email: 'demo@dev.local', isDemo: true }
const TODAY = new Date('2026-10-21T12:00:00Z')
const TOMORROW = new Date('2026-10-22T09:00:00Z')

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

it('allows 80 for the demo account', async () => {
  const store = await freshStore()
  expect(DAILY_AI_LIMIT.demo).toBe(80)
  await useUp(store, demo, 80, TODAY)
  expect(await takeAiCall(store, demo, TODAY)).toBe(false)
})

it('starts over the next day', async () => {
  const store = await freshStore()
  await useUp(store, alice, 30, TODAY)
  expect(await takeAiCall(store, alice, TOMORROW)).toBe(true)
})
