// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { heroLevel, xpForLevel } from '../../shared/game/fuel.js'
import { newHero } from '../../server/modules/game/game.model.js'
import { api, useTempStore } from './helpers.js'
import { CASE, SECRET, challengeFor } from './store-contract.js'

// The Inferno test needs level 40, far more study than a test can create: it lifts the level
// through loadFuel. Every other test runs on real study data.
const fuel = vi.hoisted(() => ({ level: null }))
vi.mock('../../server/modules/game/game.fuel.js', async (importOriginal) => {
  const real = await importOriginal()
  return {
    ...real,
    loadFuel: async (...args) => {
      const loaded = await real.loadFuel(...args)
      return fuel.level ? { ...loaded, level: heroLevel(xpForLevel(fuel.level)) } : loaded
    },
  }
})

let store

beforeEach(async () => {
  store = await useTempStore()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-25T12:00:00Z'))
})

afterEach(() => {
  fuel.level = null
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const HOUR = 3_600_000
const FOREST = 'floresta-js'
const get = () => api('/api/game', { method: 'GET' })
const post = (path, body) => api(`/api/game${path}`, { body })
const game = async () => (await get()).json()
const later = (ms) => vi.setSystemTime(new Date(Date.now() + ms))

// Every response: the hunt seed and the claimed ledger stay on the server.
async function bodyOf(res) {
  const text = await res.text()
  expect(text).not.toMatch(/"seed"|"claimed"/)
  return JSON.parse(text)
}

async function gymPasses(count) {
  for (let index = 0; index < count; index++) {
    const kase = await store.createCase('alice', CASE)
    const challenge = await store.createChallenge('alice', challengeFor(kase.id), SECRET)
    await store.updateChallenge('alice', challenge.id, { status: 'passed', attempts: 1 })
  }
}

// Gear for a hero that wins the first boss easily.
const gear = (id, slot, base, affixes) => ({
  id, kind: 'gear', base, slot, rarity: 'legendary', ilvl: 1, affixes, sockets: [], upgrade: 0, rerolls: 0, equipped: slot,
})
const STRONG = [
  gear('aaaaaaaaaaa1', 'weapon', 'espada', [{ id: 'sharp', tier: 4, value: 40 }, { id: 'honed', tier: 4, value: 48 }]),
  gear('aaaaaaaaaaa2', 'chest', 'armadura', [{ id: 'vital', tier: 4, value: 170 }, { id: 'fortified', tier: 4, value: 58 }]),
]

it('starts a new player at level 1 with no gold and only the first Normal zone open', async () => {
  const body = await bodyOf(await get())
  expect(body.level.level).toBe(1)
  expect(body.hero.gold).toBe(0)
  expect(body.hero).toMatchObject({ potions: { hp: 3, mp: 0 }, talents: ['root'], hunt: null, lastAway: null })
  expect(body.talentPoints).toEqual({ total: 0, spent: 0, free: 0 })
  // The tree reads the per-branch correct answers to show keystone progress.
  expect(body.study.branch).toEqual({ logica: 0, sintaxe: 0, algoritmos: 0 })
  expect(body.power).toBeGreaterThan(0)
  expect(body.huntPreview).toBeNull()
  const zones = body.zones[FOREST]
  expect(zones.normal.map((zone) => zone.unlocked)).toEqual([true, false, false])
  expect([...zones.pesadelo, ...zones.inferno].some((zone) => zone.unlocked)).toBe(false)
  // GET only reads: nothing was saved.
  expect(await store.getGameHero('alice')).toBeNull()
})

it('claims study rewards once on sync', async () => {
  await gymPasses(3)
  expect((await game()).study.pending.fragments).toBe(30)
  const first = await bodyOf(await post('/sync'))
  expect(first.hero.fragments).toBe(30)
  expect(first.studyClaimed.fragments).toBe(30)
  expect(first.study.pending.fragments).toBe(0)
  const second = await bodyOf(await post('/sync'))
  expect(second.hero.fragments).toBe(30)
  expect(second.studyClaimed).toBeUndefined()
})

it('hunts while away and pays on sync, and keeps the hunt going', async () => {
  const started = await bodyOf(await post('/hunt', { world: FOREST, zone: 'z1', difficulty: 'normal' }))
  expect(started.hero.hunt).toMatchObject({ world: FOREST, zone: 'z1', difficulty: 'normal', startedAt: Date.now(), claims: 0 })
  later(HOUR)
  const preview = await bodyOf(await get())
  expect(preview.huntPreview.kills).toBeGreaterThan(0)
  const synced = await bodyOf(await post('/sync'))
  expect(synced.away.kills).toBeGreaterThan(0)
  expect(synced.away.elapsedMs).toBe(HOUR)
  expect(synced.hero.gold).toBeGreaterThan(0)
  expect(synced.hero.gold).toBe(synced.away.gold)
  expect(synced.away).toMatchObject(preview.huntPreview)
  expect(synced.hero.lastAway).toEqual(synced.away)
  expect(Object.keys(synced.away).sort()).toEqual(['deaths', 'elapsedMs', 'elites', 'gems', 'gold', 'items', 'kills', 'scrap'])
  expect(synced.hero.items.length).toBe(synced.away.items + synced.away.gems)
  expect(synced.hero.hunt).toMatchObject({ zone: 'z1', startedAt: Date.now(), claims: 1 })
})

it('leaves a hunt under 5 minutes running and unsaved on sync, then settles it at 6 minutes', async () => {
  const started = await bodyOf(await post('/hunt', { world: FOREST, zone: 'z1', difficulty: 'normal' }))
  const { version } = await store.getGameHero('alice')
  for (const minute of [1, 2]) {
    later(60_000)
    const synced = await bodyOf(await post('/sync'))
    expect(synced.away, `minute ${minute}`).toBeUndefined()
    expect(synced.hero.gold).toBe(0)
    expect(synced.hero.hunt).toEqual(started.hero.hunt)
    expect(synced.huntPreview.elapsedMs).toBe(minute * 60_000)
    // Nothing changed, so nothing was written.
    expect((await store.getGameHero('alice')).version).toBe(version)
  }
  later(4 * 60_000)
  const settled = await bodyOf(await post('/sync'))
  expect(settled.away.elapsedMs).toBe(6 * 60_000)
  expect(settled.hero.gold).toBe(settled.away.gold)
  expect(settled.hero.hunt).toMatchObject({ startedAt: Date.now(), claims: 1 })
  expect((await store.getGameHero('alice')).version).toBe(version + 1)
})

it('stops a hunt after settling it', async () => {
  await post('/hunt', { world: FOREST, zone: 'z1', difficulty: 'normal' })
  later(HOUR)
  const stopped = await bodyOf(await post('/hunt/stop'))
  expect(stopped.hero.hunt).toBeNull()
  expect(stopped.hero.gold).toBeGreaterThan(0)
  expect(stopped.huntPreview).toBeNull()
})

it('refuses a locked zone and bad hunt intents with 400', async () => {
  const locked = await post('/hunt', { world: FOREST, zone: 'z2', difficulty: 'normal' })
  expect(locked.status).toBe(400)
  expect((await locked.json()).message).toBe('This zone is still locked.')
  for (const body of [{ world: 'nowhere', zone: 'z1', difficulty: 'normal' }, { world: FOREST, zone: 'constructor', difficulty: 'normal' }, { world: FOREST, zone: 'z1', difficulty: 'easy' }, { world: FOREST, zone: 'z1' }]) {
    expect((await post('/hunt', body)).status).toBe(400)
  }
})

it('ignores drops, gold and stats the client sends', async () => {
  const res = await post('/hunt', { world: FOREST, zone: 'z1', difficulty: 'normal', gold: 99999, items: [{ id: 'x' }], level: 60 })
  const body = await bodyOf(res)
  expect(body.hero.gold).toBe(0)
  expect(body.hero.items).toEqual([])
})

// Review Focus 1: two tabs sync the same hunt at once. Both read the same hero before either
// saves (the barrier makes that certain), so the optimistic version lets only one of them pay.
it('lets only one of two concurrent syncs settle the hunt', async () => {
  await post('/hunt', { world: FOREST, zone: 'z1', difficulty: 'normal' })
  later(HOUR)
  const before = await store.getGameHero('alice')
  const read = store.getGameHero.bind(store)
  const waiting = []
  vi.spyOn(store, 'getGameHero').mockImplementation(async (userId) => {
    const hero = await read(userId)
    await new Promise((resolve) => {
      waiting.push(resolve)
      if (waiting.length === 2) for (const release of waiting) release()
    })
    return hero
  })
  const [a, b] = await Promise.all([post('/sync'), post('/sync')])
  expect([a.status, b.status].sort()).toEqual([200, 409])
  const [ok, refused] = a.status === 200 ? [a, b] : [b, a]
  expect(await refused.json()).toEqual({ message: 'Your hero changed in another tab. Reload to continue.', code: 'GAME_CONFLICT' })
  const won = await bodyOf(ok)
  expect(won.away.gold).toBeGreaterThan(0)
  vi.restoreAllMocks()
  const after = await store.getGameHero('alice')
  expect(after.version).toBe(before.version + 1)
  expect(after.data.gold).toBe(won.away.gold)
  expect(after.data.hunt.claims).toBe(1)
})

// Review Focus 4: a hunt that claims to start in the future pays nothing.
it('pays nothing for a hunt that starts in the future', async () => {
  const hero = newHero()
  hero.hunt = { world: FOREST, zone: 'z1', difficulty: 'normal', startedAt: Date.now() + HOUR, seed: 'alice:test', claims: 0 }
  await store.saveGameHero('alice', hero, 0)
  const synced = await bodyOf(await post('/sync'))
  expect(synced.away).toBeUndefined()
  expect(synced.hero.gold).toBe(0)
  expect(synced.hero.items).toEqual([])
  expect(synced.hero.hunt.startedAt).toBe(Date.now())
})

it('subtracts the potions a hunt drank, never below zero', async () => {
  const hero = newHero()
  hero.potions = { hp: 1, mp: 0 }
  hero.hunt = { world: FOREST, zone: 'z1', difficulty: 'normal', startedAt: Date.now(), seed: 'alice:potions', claims: 0 }
  await store.saveGameHero('alice', hero, 0)
  later(8 * HOUR)
  const synced = await bodyOf(await post('/sync'))
  expect(synced.hero.potions.hp).toBeGreaterThanOrEqual(0)
  expect(synced.hero.potions.hp).toBeLessThanOrEqual(1)
})

it('refuses a boss above the hero level, and records a win with its loot', async () => {
  const early = await post('/boss', { world: FOREST, zone: 'z1', difficulty: 'normal' })
  expect(early.status).toBe(400)
  expect((await early.json()).message).toBe('Your hero needs a higher level for this boss.')

  // Gym passes are app XP: enough of them lift the hero to the first boss's level.
  await gymPasses(8)
  const hero = newHero()
  hero.items = STRONG
  await store.saveGameHero('alice', hero, 0)
  const ready = await game()
  expect(ready.level.level).toBeGreaterThanOrEqual(5)

  const res = await post('/boss', { world: FOREST, zone: 'z1', difficulty: 'normal' })
  expect(res.status).toBe(200)
  const body = await bodyOf(res)
  expect(body.fight.won).toBe(true)
  expect(body.fight.log.length).toBeGreaterThan(0)
  expect(body.hero.progress[FOREST].normal).toEqual(['z1'])
  expect(body.zones[FOREST].normal.find((zone) => zone.id === 'z1').beaten).toBe(true)
  const loot = body.hero.items.filter((item) => !item.equipped)
  expect(loot.map((item) => item.kind).sort()).toEqual(['gear', 'gem'])
  expect(body.fight.loot).toMatchObject({ items: 1, gems: 1, goldLost: 0 })

  // Only the first win pays: a beaten boss fought again drops nothing.
  const again = await bodyOf(await post('/boss', { world: FOREST, zone: 'z1', difficulty: 'normal' }))
  expect(again.fight.won).toBe(true)
  expect(again.fight.log.length).toBeGreaterThan(0)
  expect(again.fight.loot).toEqual({ items: 0, gems: 0, scrap: 0, goldLost: 0 })
  expect(again.hero.items).toEqual(body.hero.items)
  expect(again.hero.progress[FOREST].normal).toEqual(['z1'])
})

it('takes 10% of the gold when an Inferno boss wins', async () => {
  fuel.level = 40
  const hero = newHero()
  hero.gold = 1000
  hero.progress = { [FOREST]: { normal: ['z1', 'z2', 'z3'], pesadelo: ['z1', 'z2', 'z3'] } }
  await store.saveGameHero('alice', hero, 0)
  const res = await post('/boss', { world: FOREST, zone: 'z1', difficulty: 'inferno' })
  const body = await bodyOf(res)
  expect(body.fight.won).toBe(false)
  expect(body.hero.gold).toBe(900)
  expect(body.fight.loot.goldLost).toBe(100)
  expect(body.hero.progress[FOREST].inferno ?? []).toEqual([])
})

it('costs nothing to lose a Normal boss', async () => {
  fuel.level = 5
  const hero = newHero()
  hero.gold = 1000
  hero.potions = { hp: 0, mp: 0 }
  await store.saveGameHero('alice', hero, 0)
  const body = await bodyOf(await post('/boss', { world: FOREST, zone: 'z1', difficulty: 'normal' }))
  expect(body.fight.won).toBe(false)
  expect(body.hero.gold).toBe(1000)
})

it('needs a session', async () => {
  expect((await api('/api/game', { method: 'GET', token: null })).status).toBe(401)
  expect((await api('/api/game/sync', { token: null })).status).toBe(401)
})
