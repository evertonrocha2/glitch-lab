// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { heroLevel, xpForLevel } from '../../shared/game/fuel.js'
import { bossXp, huntXp } from '../../shared/game/xp.js'
import { ZONES } from '../../shared/game/zones.js'
import { newHero } from '../../server/modules/game/game.model.js'
import { api, useTempStore } from './helpers.js'
import { CASE, SECRET, challengeFor } from './store-contract.js'

// The Inferno test needs level 40, far more study than a test can create: it lifts the study XP a
// hero without stored xp starts from (the migration) through loadFuel. Every other test runs on real
// study data.
const fuel = vi.hoisted(() => ({ level: null }))
vi.mock('../../server/modules/game/game.fuel.js', async (importOriginal) => {
  const real = await importOriginal()
  return {
    ...real,
    loadFuel: async (...args) => {
      const loaded = await real.loadFuel(...args)
      return fuel.level ? { ...loaded, studyXp: xpForLevel(fuel.level) } : loaded
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

it('starts a new player at level 1 with no gold and every zone of every difficulty open', async () => {
  const body = await bodyOf(await get())
  expect(body.level.level).toBe(1)
  expect(body.hero.gold).toBe(0)
  expect(body.hero).toMatchObject({ potions: { hp: 3, mp: 0 }, talents: ['root'], hunt: null, lastAway: null })
  expect(body.talentPoints).toEqual({ total: 0, spent: 0, free: 0 })
  // The tree reads the per-branch correct answers to show keystone progress.
  expect(body.study.branch).toEqual({ logica: 0, sintaxe: 0, algoritmos: 0 })
  expect(body.power).toBeGreaterThan(0)
  expect(body.huntPreview).toBeNull()
  // No acertos today: XP x1.0.
  expect(body.study.xpMultiplier).toBe(1)
  const zones = body.zones[FOREST]
  for (const difficulty of ['normal', 'pesadelo', 'inferno']) expect(zones[difficulty].map((zone) => zone.unlocked)).toEqual([true, true, true])
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
  expect(first.study.xpMultiplier).toBe(1.3)
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
  const { samples, ...counts } = preview.huntPreview
  expect(synced.away).toMatchObject(counts)
  // A few sample pack fights ride along for the client to animate, each with its pack leader; in z1
  // one pack in every 1.75 has an elite leading it, the second one first.
  expect(samples).toHaveLength(3)
  for (const fight of samples) {
    expect(fight.log.length).toBeGreaterThan(0)
    expect(fight.log.filter((ev) => ev.type === 'spawn').length).toBeGreaterThanOrEqual(3)
    expect(fight.enemy).toEqual({ id: expect.any(String), sprite: expect.any(String), elite: expect.any(Boolean) })
  }
  expect(samples.map((fight) => fight.enemy.elite)).toEqual([false, true, false])
  expect(synced.hero.lastAway).toEqual(synced.away)
  expect(Object.keys(synced.away).sort()).toEqual([
    'deaths', 'elapsedMs', 'elites', 'fragments', 'gems', 'gold', 'items', 'kills', 'levelsGained', 'scrap', 'supports', 'xp', 'xpMultiplier',
  ])
  expect(synced.hero.items.length).toBe(synced.away.items + synced.away.gems + synced.away.supports)
  // Fase 4: the monsters dropped knowledge fragments, paid into the hero.
  expect(synced.away.fragments).toBeGreaterThan(0)
  expect(synced.hero.fragments).toBe(started.hero.fragments + synced.away.fragments)
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

it('starts a hunt in zone 3 at level 1, on any difficulty', async () => {
  const deep = await bodyOf(await post('/hunt', { world: FOREST, zone: 'z3', difficulty: 'normal' }))
  expect(deep.level.level).toBe(1)
  expect(deep.hero.hunt).toMatchObject({ world: FOREST, zone: 'z3', difficulty: 'normal' })
  const inferno = await bodyOf(await post('/hunt', { world: FOREST, zone: 'z2', difficulty: 'inferno' }))
  expect(inferno.hero.hunt).toMatchObject({ zone: 'z2', difficulty: 'inferno' })
})

it('refuses bad hunt intents with 400', async () => {
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

it('lets a level 1 hero fight any boss, and a loss marks nothing', async () => {
  for (const [zone, difficulty] of [['z3', 'normal'], ['z1', 'pesadelo']]) {
    const res = await post('/boss', { world: FOREST, zone, difficulty })
    expect(res.status).toBe(200)
    const body = await bodyOf(res)
    expect(body.level.level).toBe(1)
    expect(body.fight.won).toBe(false)
    expect(body.fight.loot).toMatchObject({ items: 0, gems: 0, xp: 0 })
    expect(body.hero.progress[FOREST]?.[difficulty] ?? []).toEqual([])
  }
})

it('records a boss win with its loot', async () => {

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
  // The boss spawns first; its phases call adds (summoner 0), and the fight ends with the boss.
  const spawns = body.fight.log.filter((ev) => ev.type === 'spawn')
  expect(spawns[0]).toMatchObject({ src: 0, boss: true, id: 'rei-slime' })
  expect(spawns.slice(1).every((ev) => ev.summoner === 0)).toBe(true)
  expect(body.fight.log.at(-1)).toMatchObject({ type: 'death', who: 'enemy', src: 0 })
  expect(body.hero.progress[FOREST].normal).toEqual(['z1'])
  expect(body.zones[FOREST].normal.find((zone) => zone.id === 'z1').beaten).toBe(true)
  const loot = body.hero.items.filter((item) => !item.equipped)
  // Fase 2c: the first win also drops a support gem, for sure.
  expect(loot.map((item) => item.kind).sort()).toEqual(['gear', 'gem', 'support'])
  expect(body.fight.loot).toMatchObject({ items: 1, gems: 1, supports: 1, goldLost: 0 })
  // The first win pays XP, times today's multiplier (8 gym passes: x1.8).
  expect(body.fight.loot.xp).toBe(bossXp(ZONES[FOREST].z1, 'normal', 1.8))
  expect(body.level.xp).toBe(ready.level.xp + body.fight.loot.xp)
  expect(body.fight.loot.levelsGained).toBe(body.level.level - ready.level.level)

  // Fase 4: the first win drops 30 knowledge fragments.
  expect(body.fight.loot.fragments).toBe(30)
  expect(body.hero.fragments).toBe(ready.hero.fragments + 30)

  // Only the first win pays gear and xp: a beaten boss fought again drops nothing more that day.
  const again = await bodyOf(await post('/boss', { world: FOREST, zone: 'z1', difficulty: 'normal' }))
  expect(again.fight.won).toBe(true)
  expect(again.fight.log.length).toBeGreaterThan(0)
  expect(again.fight.loot).toEqual({ items: 0, gems: 0, supports: 0, scrap: 0, goldLost: 0, xp: 0, levelsGained: 0, fragments: 0 })
  expect(again.level.xp).toBe(body.level.xp)
  expect(again.hero.items).toEqual(body.hero.items)
  expect(again.hero.fragments).toBe(body.hero.fragments)
  expect(again.hero.progress[FOREST].normal).toEqual(['z1'])

  // The next day a win pays 10 fragments again, once.
  later(24 * HOUR)
  const tomorrow = await bodyOf(await post('/boss', { world: FOREST, zone: 'z1', difficulty: 'normal' }))
  expect(tomorrow.fight.won).toBe(true)
  expect(tomorrow.fight.loot).toMatchObject({ items: 0, xp: 0, fragments: 10 })
  expect(tomorrow.hero.fragments).toBe(again.hero.fragments + 10)
  const twice = await bodyOf(await post('/boss', { world: FOREST, zone: 'z1', difficulty: 'normal' }))
  expect(twice.fight.loot.fragments).toBe(0)
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

const z1 = ZONES[FOREST].z1
const startHunt = () => post('/hunt', { world: FOREST, zone: 'z1', difficulty: 'normal' })

it('pays hunt XP on settle and reports xp, its multiplier and the levels gained', async () => {
  const hero = newHero()
  hero.xp = xpForLevel(5)
  await store.saveGameHero('alice', hero, 0)
  const started = await bodyOf(await startHunt())
  expect(started.hero.hunt.xpMultiplier).toBe(1)
  later(HOUR)
  const preview = await bodyOf(await get())
  expect(preview.huntPreview.xp).toBeGreaterThan(0)
  const synced = await bodyOf(await post('/sync'))
  expect(synced.away.xp).toBe(preview.huntPreview.xp)
  expect(synced.away.xp).toBe(huntXp({ kills: synced.away.kills, elites: synced.away.elites, zone: z1, difficulty: 'normal' }))
  expect(synced.away.xpMultiplier).toBe(1)
  expect(synced.level.xp).toBe(xpForLevel(5) + synced.away.xp)
  expect(synced.level.level).toBe(heroLevel(xpForLevel(5) + synced.away.xp).level)
  expect(synced.away.levelsGained).toBe(synced.level.level - 5)
  expect(synced.away.levelsGained).toBeGreaterThan(0)
  expect((await store.getGameHero('alice')).data.xp).toBe(synced.level.xp)
  // Stopping pays the stretch since the last settle too.
  later(10 * 60_000)
  const stopped = await bodyOf(await post('/hunt/stop'))
  expect(stopped.level.xp).toBe(synced.level.xp + stopped.away.xp)
})

it('pays each stretch with the multiplier that held when it began; study mid-hunt boosts the next one', async () => {
  const hero = newHero()
  hero.xp = 0
  await store.saveGameHero('alice', hero, 0)
  await startHunt()
  await gymPasses(10)
  later(HOUR)
  const first = await bodyOf(await post('/sync'))
  expect(first.away.xpMultiplier).toBe(1)
  expect(first.study.xpMultiplier).toBe(2)
  expect(first.hero.hunt.xpMultiplier).toBe(2)
  later(HOUR)
  const second = await bodyOf(await post('/sync'))
  expect(second.away.xpMultiplier).toBe(2)
  expect(second.away.xp).toBe(huntXp({ kills: second.away.kills, elites: second.away.elites, zone: z1, difficulty: 'normal', multiplier: 2 }))
  expect(second.level.xp).toBe(first.level.xp + second.away.xp)
})

it('pays a hunt saved before the multiplier existed at x1', async () => {
  const hero = newHero()
  hero.xp = 0
  hero.hunt = { world: FOREST, zone: 'z1', difficulty: 'normal', startedAt: Date.now(), seed: 'alice:old', claims: 0 }
  await store.saveGameHero('alice', hero, 0)
  await gymPasses(20)
  later(HOUR)
  const synced = await bodyOf(await post('/sync'))
  expect(synced.away.xpMultiplier).toBe(1)
  expect(synced.hero.hunt.xpMultiplier).toBe(3)
})

it("reads the multiplier from the acertos on the client's day", async () => {
  await gymPasses(4)
  expect((await game()).study.xpMultiplier).toBe(1.4)
  const tomorrow = await (await api('/api/game?today=2026-11-26', { method: 'GET' })).json()
  expect(tomorrow.study.xpMultiplier).toBe(1)
})

it('migrates a hero saved without xp to the xp its study gives, stores it on the next write, then study stops adding xp', async () => {
  await gymPasses(8)
  await store.saveGameHero('alice', newHero(), 0)
  const before = await game()
  expect(before.level.level).toBeGreaterThanOrEqual(5)
  await startHunt()
  expect((await store.getGameHero('alice')).data.xp).toBe(before.level.xp)
  await gymPasses(5)
  const after = await game()
  expect(after.level.xp).toBe(before.level.xp)
  // Talent points still count acertos: 13 passes are one more point than 8.
  expect(after.talentPoints.total).toBe(before.talentPoints.total + 1)
})

it('levels up from hunt XP, with zone 2 open before and after', async () => {
  const hero = newHero()
  hero.xp = xpForLevel(8) - 1
  hero.progress = { [FOREST]: { normal: ['z1'] } }
  await store.saveGameHero('alice', hero, 0)
  expect((await game()).zones[FOREST].normal.find((zone) => zone.id === 'z2').unlocked).toBe(true)
  await startHunt()
  later(HOUR)
  const synced = await bodyOf(await post('/sync'))
  expect(synced.level.level).toBeGreaterThanOrEqual(8)
  expect(synced.zones[FOREST].normal.find((zone) => zone.id === 'z2').unlocked).toBe(true)
  expect(synced.talentPoints.total).toBe(synced.level.level - 1)
})

it('needs a session', async () => {
  expect((await api('/api/game', { method: 'GET', token: null })).status).toBe(401)
  expect((await api('/api/game/sync', { token: null })).status).toBe(401)
})
