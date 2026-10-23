// @vitest-environment node
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { eventStatus, VOTING_MS } from '../../shared/events.js'
import { seedDemo } from '../../server/modules/demo/demo.seed.js'
import { createLocalStore } from '../../server/infra/database/local/index.js'

const freshStore = async () => createLocalStore({ file: join(await mkdtemp(join(tmpdir(), 'gd-events-seed-')), 'db.json') })
const demoUser = (store) => store.createUser({ email: `demo-${crypto.randomUUID()}@demo.glitch`, passwordHash: null, isDemo: true })
const liveNow = (store) => store.listEvents({ tab: 'live', now: new Date().toISOString(), offset: 0, limit: 10 })

afterEach(() => vi.useRealTimers())

it('opens a live sample event by the sample team, with entries and votes', async () => {
  const store = await freshStore()
  const demo = await demoUser(store)
  await seedDemo(store, demo.id, '2026-10-22')

  const { events } = await liveNow(store)
  expect(events).toHaveLength(1)
  const [event] = events
  expect(event).toMatchObject({ title: 'Rinha de Backend: Glitch Edition', kind: 'battle' })
  expect(eventStatus(event)).toBe('live')
  const team = await store.findPublicProfile('glitch_team')
  expect(event.organizerId).toBe(team.userId)

  const entries = await store.listEntries(event.id)
  expect(entries.length).toBeGreaterThanOrEqual(2)
  expect(entries.length).toBeLessThanOrEqual(3)
  expect(entries.some((item) => item.votes > 0)).toBe(true)
  expect(entries.every((item) => item.userId !== event.organizerId)).toBe(true)
  // No em dashes in the sample copy (U+2014).
  const dash = new RegExp(String.fromCharCode(0x2014))
  for (const text of [event.title, event.summary, event.description, event.rules, ...entries.map((item) => item.description)]) expect(text).not.toMatch(dash)
  // The demo account itself never takes part.
  expect(await store.eventStats(demo.id)).toMatchObject({ entries: 0, votesReceived: 0 })
})

it('opens a live sample event in Portuguese for a pt-BR demo, once', async () => {
  const store = await freshStore()
  await seedDemo(store, (await demoUser(store)).id, '2026-10-22', 'pt-BR')
  await seedDemo(store, (await demoUser(store)).id, '2026-10-22', 'pt-BR')
  const { events } = await liveNow(store)
  expect(events).toHaveLength(1)
  const [event] = events
  expect(event).toMatchObject({ title: 'Rinha de Backend: edição Glitch', kind: 'battle' })
  expect(event.summary).toMatch(/Construa uma API de pagamentos/)
  expect(event.rules).toMatch(/Uma participação por pessoa/)
  const entries = await store.listEntries(event.id)
  expect(entries.map((item) => item.title).sort()).toEqual(['Fila primeiro, depois Postgres', 'Um arquivo, zero dependências'])
  expect(entries.every((item) => item.description.startsWith('Participação de exemplo.'))).toBe(true)
  const dash = new RegExp(String.fromCharCode(0x2014))
  for (const text of [event.title, event.summary, event.description, event.rules, event.prizes, ...entries.map((item) => item.description)]) expect(text).not.toMatch(dash)

  // An English demo still gets its own English event next to it.
  await seedDemo(store, (await demoUser(store)).id, '2026-10-22')
  expect((await liveNow(store)).events.map((item) => item.title).sort()).toEqual(['Rinha de Backend: Glitch Edition', 'Rinha de Backend: edição Glitch'])
})

it('makes the sample once while it runs, and a new one once it is over', async () => {
  const store = await freshStore()
  await seedDemo(store, (await demoUser(store)).id, '2026-10-22')
  await seedDemo(store, (await demoUser(store)).id, '2026-10-22')
  expect((await liveNow(store)).events).toHaveLength(1)

  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + 5 * 86_400_000 + VOTING_MS)
  expect((await liveNow(store)).events).toHaveLength(0)
  await seedDemo(store, (await demoUser(store)).id, '2026-10-29')
  expect((await liveNow(store)).events).toHaveLength(1)
})
