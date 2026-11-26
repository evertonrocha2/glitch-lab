// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { heroLevel, talentPoints, xpForLevel } from '../../shared/game/fuel.js'
import { AFFIXES, BAG_SIZE, GEMS, salvageValue } from '../../shared/game/items.js'
import { newHero } from '../../server/modules/game/game.model.js'
import { api, useTempStore } from './helpers.js'

// Most tests need a level (and its talent points) far above what a test can study for: loadFuel
// lifts both. fuel.level null keeps the real level 1.
const fuel = vi.hoisted(() => ({ level: null }))
vi.mock('../../server/modules/game/game.fuel.js', async (importOriginal) => {
  const real = await importOriginal()
  return {
    ...real,
    loadFuel: async (...args) => {
      const loaded = await real.loadFuel(...args)
      if (!fuel.level) return loaded
      return { ...loaded, level: heroLevel(xpForLevel(fuel.level)), talentPoints: talentPoints(fuel.level, loaded.ledger.totals.correct) }
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

const MINUTE = 60_000
const FOREST = 'floresta-js'
const get = () => api('/api/game', { method: 'GET' })
const post = (path, body) => api(`/api/game${path}`, { body })
const put = (path, body) => api(`/api/game${path}`, { method: 'PUT', body })
const later = (ms) => vi.setSystemTime(new Date(Date.now() + ms))

async function bodyOf(res) {
  const text = await res.text()
  expect(res.status, text).toBe(200)
  expect(text).not.toMatch(/"seed"|"claimed"/)
  return JSON.parse(text)
}

async function refused(res, message) {
  expect(res.status).toBe(400)
  const body = await res.json()
  if (message) expect(body.message).toBe(message)
  return body
}

const saveHero = (patch) => store.saveGameHero('alice', { ...newHero(), ...patch }, 0)
const stored = async () => (await store.getGameHero('alice')).data

let nextId = 0
const gear = (patch = {}) => ({
  id: `item${String(nextId++).padStart(8, '0')}`,
  kind: 'gear',
  base: 'espada',
  slot: 'weapon',
  rarity: 'common',
  ilvl: 1,
  affixes: [],
  sockets: [],
  upgrade: 0,
  rerolls: 0,
  equipped: null,
  ...patch,
})
const gem = (name = 'logica') => ({ id: `gem${String(nextId++).padStart(9, '0')}`, kind: 'gem', gem: name })
const filler = (count) => Array.from({ length: count }, () => gear({ base: 'anel', slot: 'ring' }))

const M = {
  badItem: "That item can't be used for this.",
  bagFull: 'Your bag is full.',
  noGold: 'Not enough gold.',
  noFragments: 'Not enough knowledge fragments.',
  noScrap: 'Not enough scrap.',
  noChest: 'You have no chest to open.',
  skillLocked: 'Your hero needs a higher level for this skill.',
  notOwned: "Your hero doesn't have this skill yet.",
  badLoadout: 'Pick skills your hero has, each one once.',
  maxLevel: 'This is already at its max level.',
  talent: "You can't take that talent.",
}

it('equips gear, sends the old piece back to the bag and unequips it again', async () => {
  const sword = gear({ affixes: [{ id: 'sharp', tier: 0, value: 3 }] })
  const better = gear({ rarity: 'rare', affixes: [{ id: 'sharp', tier: 2, value: 14 }] })
  await saveHero({ items: [sword, better] })
  const before = await bodyOf(await get())

  const first = await bodyOf(await post('/equip', { itemId: sword.id }))
  expect(first.hero.items.find((item) => item.id === sword.id).equipped).toBe('weapon')
  expect(first.power).toBeGreaterThan(before.power)

  const second = await bodyOf(await post('/equip', { itemId: better.id }))
  expect(second.hero.items.find((item) => item.id === better.id).equipped).toBe('weapon')
  expect(second.hero.items.find((item) => item.id === sword.id).equipped).toBeNull()
  expect(second.power).toBeGreaterThan(first.power)

  const off = await bodyOf(await post('/unequip', { slot: 'weapon' }))
  expect(off.hero.items.every((item) => item.equipped === null)).toBe(true)
  expect(off.power).toBe(before.power)
})

it('refuses to equip a gem, a missing item or an equipped one, and to unequip into a full bag', async () => {
  const ruby = gem()
  const worn = gear({ equipped: 'weapon' })
  await saveHero({ items: [ruby, worn, ...filler(BAG_SIZE - 1)] })
  await refused(await post('/equip', { itemId: ruby.id }), M.badItem)
  await refused(await post('/equip', { itemId: worn.id }), M.badItem)
  await refused(await post('/equip', { itemId: 'nothing-here' }), M.badItem)
  for (const body of [{}, { itemId: 7 }, { itemId: ['x'] }]) await refused(await post('/equip', body))
  // 59 fillers + the gem make 60 in the bag.
  await refused(await post('/unequip', { slot: 'weapon' }), M.bagFull)
  await refused(await post('/unequip', { slot: 'helm' }), M.badItem)
  for (const slot of ['constructor', '__proto__', 'hat', 3]) await refused(await post('/unequip', { slot }))
  expect((await stored()).items.find((item) => item.id === worn.id).equipped).toBe('weapon')
})

it('allocates talents in order and refuses the whole list when one is refused', async () => {
  fuel.level = 6 // 5 points
  await saveHero({})
  const ok = await bodyOf(await post('/talents', { add: ['logica-c0', 'logica-c1'] }))
  expect(ok.hero.talents).toEqual(['root', 'logica-c0', 'logica-c1'])
  expect(ok.talentPoints).toEqual({ total: 5, spent: 2, free: 3 })

  const { version } = await store.getGameHero('alice')
  const far = await refused(await post('/talents', { add: ['sintaxe-c0', 'logica-c5'] }), M.talent)
  expect(far.reason).toBe('notAdjacent')
  expect((await stored()).talents).toEqual(['root', 'logica-c0', 'logica-c1'])
  expect((await store.getGameHero('alice')).version).toBe(version)

  expect((await refused(await post('/talents', { add: ['logica-c0'] }))).reason).toBe('taken')
  expect((await refused(await post('/talents', { add: ['constructor'] }))).reason).toBe('unknown')
  expect((await refused(await post('/talents', { add: ['logica-c2', 'logica-c3', 'logica-c4', 'logica-f2-1'] }))).reason).toBe('noPoints')
  for (const body of [{}, { add: [] }, { add: 'logica-c2' }, { add: [5] }]) await refused(await post('/talents', body))
})

it('refunds every talent on respec and charges 50 gold per point', async () => {
  fuel.level = 6
  await saveHero({ gold: 99, talents: ['root', 'logica-c0', 'logica-c1'] })
  await refused(await post('/talents/respec'), M.noGold)
  await store.saveGameHero('alice', { ...(await stored()), gold: 130 }, 1)
  const body = await bodyOf(await post('/talents/respec'))
  expect(body.hero.talents).toEqual(['root'])
  expect(body.hero.gold).toBe(30)
  expect(body.talentPoints).toEqual({ total: 5, spent: 0, free: 5 })
})

it('buys a skill only at its level and with the fragments, and upgrades it', async () => {
  await saveHero({ fragments: 500 })
  await refused(await post('/skills/buy', { skillId: 'raio' }), M.skillLocked)
  fuel.level = 3
  await store.saveGameHero('alice', { ...(await stored()), fragments: 29 }, 1)
  await refused(await post('/skills/buy', { skillId: 'raio' }), M.noFragments)
  await store.saveGameHero('alice', { ...(await stored()), fragments: 100 }, 2)
  const bought = await bodyOf(await post('/skills/buy', { skillId: 'raio' }))
  expect(bought.hero.skills.owned).toEqual({ golpe: 1, raio: 1 })
  expect(bought.hero.fragments).toBe(70)
  await refused(await post('/skills/buy', { skillId: 'raio' }))
  for (const skillId of ['constructor', 'toString', 'nope', 1]) await refused(await post('/skills/buy', { skillId }))

  const up = await bodyOf(await post('/skills/upgrade', { skillId: 'raio' }))
  expect(up.hero.skills.owned.raio).toBe(2)
  expect(up.hero.fragments).toBe(30)
  await refused(await post('/skills/upgrade', { skillId: 'raio' }), M.noFragments)
  await refused(await post('/skills/upgrade', { skillId: 'chama' }), M.notOwned)
  await refused(await post('/skills/upgrade', { skillId: 'constructor' }))
})

it('stops upgrading a skill at its max level', async () => {
  await saveHero({ fragments: 9999, skills: { owned: { golpe: 5 }, loadout: ['golpe', null, null, null] } })
  await refused(await post('/skills/upgrade', { skillId: 'golpe' }), M.maxLevel)
})

it('sets the loadout and potion thresholds, owned skills only and each once', async () => {
  await saveHero({ skills: { owned: { golpe: 1, raio: 2 }, loadout: ['golpe', null, null, null] } })
  const set = await bodyOf(await put('/loadout', { skills: [null, 'raio', 'golpe', null], thresholds: { hp: 0.5, mp: 0 } }))
  expect(set.hero.skills).toEqual({ owned: { golpe: 1, raio: 2 }, loadout: [null, 'raio', 'golpe', null] })
  expect(set.hero.thresholds).toEqual({ hp: 0.5, mp: 0 })
  const thresholds = { hp: 0.4, mp: 0.25 }
  await refused(await put('/loadout', { skills: ['golpe', 'golpe', null, null], thresholds }), M.badLoadout)
  await refused(await put('/loadout', { skills: ['chama', null, null, null], thresholds }), M.badLoadout)
  await refused(await put('/loadout', { skills: ['constructor', null, null, null], thresholds }), M.badLoadout)
  for (const body of [
    { skills: ['golpe', null, null], thresholds },
    { skills: ['golpe', null, null, null, null], thresholds },
    { skills: ['golpe', 3, null, null], thresholds },
    { skills: ['golpe', null, null, null], thresholds: { hp: 0.95, mp: 0 } },
    { skills: ['golpe', null, null, null], thresholds: { hp: -0.1, mp: 0 } },
    { skills: ['golpe', null, null, null], thresholds: { hp: '0.5', mp: 0 } },
    { skills: ['golpe', null, null, null], thresholds: { hp: 0.5 } },
    { skills: ['golpe', null, null, null] },
  ]) await refused(await put('/loadout', body))
  expect((await stored()).thresholds).toEqual({ hp: 0.5, mp: 0 })
})

it('spends the forge cost on a success and on a failure, and only a success adds a level', async () => {
  // At +9 the chance is 37%: forty tries see both outcomes.
  const items = Array.from({ length: 40 }, () => gear({ upgrade: 9 }))
  await saveHero({ gold: 10_000_000, scrap: 10_000, items })
  const outcomes = new Set()
  let { gold, scrap } = await stored()
  for (const item of items) {
    const body = await bodyOf(await post('/forge/upgrade', { itemId: item.id }))
    expect(body.hero.gold).toBe(gold - 50 * 100)
    expect(body.hero.scrap).toBe(scrap - 50)
    expect(body.hero.items.find((each) => each.id === item.id).upgrade).toBe(body.forge.ok ? 10 : 9)
    outcomes.add(body.forge.ok)
    ;({ gold, scrap } = body.hero)
    if (outcomes.size === 2) break
  }
  expect([...outcomes].sort()).toEqual([false, true])
})

it('refuses a forge upgrade it can not pay for, a gem and a +10 item', async () => {
  const cheap = gear()
  const maxed = gear({ upgrade: 10 })
  const ruby = gem()
  await saveHero({ gold: 49, scrap: 100, items: [cheap, maxed, ruby] })
  await refused(await post('/forge/upgrade', { itemId: cheap.id }), M.noGold)
  await store.saveGameHero('alice', { ...(await stored()), gold: 50, scrap: 4 }, 1)
  await refused(await post('/forge/upgrade', { itemId: cheap.id }), M.noScrap)
  await refused(await post('/forge/upgrade', { itemId: maxed.id }), M.maxLevel)
  await refused(await post('/forge/upgrade', { itemId: ruby.id }), M.badItem)
  // A +0 upgrade never fails.
  await store.saveGameHero('alice', { ...(await stored()), scrap: 5 }, 2)
  const body = await bodyOf(await post('/forge/upgrade', { itemId: cheap.id }))
  expect(body.forge).toEqual({ ok: true })
  expect(body.hero).toMatchObject({ gold: 0, scrap: 0 })
})

it('salvages bag items into scrap and refuses equipped ones', async () => {
  const rare = gear({ rarity: 'rare', upgrade: 2 })
  const common = gear()
  const ruby = gem()
  const worn = gear({ equipped: 'weapon' })
  await saveHero({ scrap: 1, items: [rare, common, ruby, worn] })
  await refused(await post('/forge/salvage', { itemIds: [common.id, worn.id] }), M.badItem)
  expect((await stored()).items).toHaveLength(4)
  const body = await bodyOf(await post('/forge/salvage', { itemIds: [rare.id, common.id, ruby.id] }))
  expect(body.hero.scrap).toBe(1 + salvageValue(rare).scrap + salvageValue(common).scrap + 10)
  expect(body.hero.items.map((item) => item.id)).toEqual([worn.id])
  for (const itemIds of [[], 'x', [common.id], [worn.id, worn.id], [3]]) await refused(await post('/forge/salvage', { itemIds }))
})

it('rerolls only the chosen affix within the item tiers and raises its reroll cost', async () => {
  const ring = gear({
    base: 'anel',
    slot: 'ring',
    rarity: 'epic',
    ilvl: 12,
    affixes: [{ id: 'sharp', tier: 1, value: 5 }, { id: 'precise', tier: 0, value: 1 }, { id: 'vital', tier: 1, value: 20 }],
  })
  await saveHero({ gold: 599, fragments: 40, items: [ring] })
  const body = await bodyOf(await post('/forge/reroll', { itemId: ring.id, affix: 1 }))
  const after = body.hero.items[0]
  expect(after.affixes[0]).toEqual(ring.affixes[0])
  expect(after.affixes[2]).toEqual(ring.affixes[2])
  expect({ ...after, affixes: null, rerolls: null }).toEqual({ ...ring, affixes: null, rerolls: null })
  expect(after.rerolls).toBe(1)
  expect(body.hero).toMatchObject({ gold: 399, fragments: 20 })
  const rolled = after.affixes[1]
  const def = AFFIXES.find((each) => each.id === rolled.id)
  expect(def.slots === 'any' || def.slots.includes('ring')).toBe(true)
  expect(['attack', 'hp']).not.toContain(def.stat)
  expect(def.tiers[rolled.tier].minIlvl).toBeLessThanOrEqual(12)
  expect(rolled.value).toBeGreaterThanOrEqual(def.tiers[rolled.tier].min)
  expect(rolled.value).toBeLessThanOrEqual(def.tiers[rolled.tier].max)

  // The second reroll costs 400 gold, one more than is left.
  await refused(await post('/forge/reroll', { itemId: ring.id, affix: 0 }), M.noGold)
  for (const affix of [3, -1, 1.5, '1', null]) await refused(await post('/forge/reroll', { itemId: ring.id, affix }))
})

it('needs fragments to reroll', async () => {
  const ring = gear({ base: 'anel', slot: 'ring', rarity: 'uncommon', affixes: [{ id: 'sharp', tier: 0, value: 2 }] })
  await saveHero({ gold: 600, fragments: 19, items: [ring] })
  await refused(await post('/forge/reroll', { itemId: ring.id, affix: 0 }), M.noFragments)
})

it('sockets a gem into gear: the gem leaves the bag and its stats count', async () => {
  const blade = gear({ rarity: 'legendary', sockets: [null, null], equipped: 'weapon' })
  const ruby = gem('logica')
  const other = gem('sintaxe')
  await saveHero({ items: [blade, ruby, other] })
  const before = await bodyOf(await get())
  const body = await bodyOf(await post('/forge/socket', { itemId: blade.id, gemId: ruby.id, socket: 1 }))
  expect(body.hero.items.map((item) => item.id)).toEqual([blade.id, other.id])
  expect(body.hero.items[0].sockets).toEqual([null, 'logica'])
  expect(body.stats.attack).toBeGreaterThan(before.stats.attack)
  expect(GEMS.logica.attackPct).toBeGreaterThan(0)
  await refused(await post('/forge/socket', { itemId: blade.id, gemId: other.id, socket: 1 }), M.badItem)
  await refused(await post('/forge/socket', { itemId: other.id, gemId: blade.id, socket: 0 }), M.badItem)
  for (const socket of [2, -1, '0', 0.5]) await refused(await post('/forge/socket', { itemId: blade.id, gemId: other.id, socket }))
})

it('opens the oldest chest at the highest beaten zone ilvl, and refuses with no chest', async () => {
  await saveHero({})
  await refused(await post('/chests/open'), M.noChest)
  await store.saveGameHero(
    'alice',
    { ...(await stored()), chests: [{ day: '2026-11-24', boost: 0.3 }, { day: '2026-11-20', boost: 0.1 }], progress: { [FOREST]: { normal: ['z1', 'z2'] } } },
    1,
  )
  const body = await bodyOf(await post('/chests/open'))
  expect(body.hero.chests).toEqual([{ day: '2026-11-24', boost: 0.3 }])
  expect(body.hero.items).toHaveLength(1)
  expect(body.hero.items[0]).toMatchObject({ kind: 'gear', ilvl: 8, equipped: null })
  expect(body.chest.item).toEqual(body.hero.items[0])
  expect(body.overflow).toBeUndefined()
})

it('opens a chest at ilvl 1 when no zone is beaten', async () => {
  await saveHero({ chests: [{ day: '2026-11-24', boost: 0 }] })
  const body = await bodyOf(await post('/chests/open'))
  expect(body.hero.items[0].ilvl).toBe(1)
})

it('buys potions at 40 gold each, 1 to 20 at a time', async () => {
  await saveHero({ gold: 1000 })
  const body = await bodyOf(await post('/potions/buy', { kind: 'mp', count: 20 }))
  expect(body.hero).toMatchObject({ gold: 200, potions: { hp: 3, mp: 20 } })
  await refused(await post('/potions/buy', { kind: 'hp', count: 6 }), M.noGold)
  for (const body of [{ kind: 'hp', count: 0 }, { kind: 'hp', count: 21 }, { kind: 'hp', count: 1.5 }, { kind: 'hp', count: '2' }, { kind: 'xp', count: 1 }, { kind: '__proto__', count: 1 }, { count: 1 }]) {
    await refused(await post('/potions/buy', body))
  }
  expect((await stored()).gold).toBe(200)
})

it('sets the look and lookSet, and refuses a bad body', async () => {
  await saveHero({})
  const look = { skin: 4, hairStyle: 5, hairColor: 7, eyeStyle: 3, eyeColor: 3, outfit: 7 }
  const body = await bodyOf(await put('/look', look))
  expect(body.hero.look).toEqual(look)
  expect(body.hero.lookSet).toBe(true)
  const bad = [{ ...look, skin: 5 }, { ...look, outfit: -1 }, { ...look, hairStyle: 1.5 }, { ...look, eyeColor: '1' }, { skin: 0 }, { hood: 1, outfit: 0, hair: 0 }]
  for (const each of bad) await refused(await put('/look', each))
  const saved = await stored()
  expect(saved.look).toEqual(look)
  expect(saved.lookSet).toBe(true)
})

it('shows a legacy hero with a normalized look and lookSet false', async () => {
  const { lookSet: _lookSet, ...legacy } = newHero()
  await store.saveGameHero('alice', { ...legacy, look: { hood: 3, outfit: 5, hair: 2 } }, 0)
  const { hero } = await bodyOf(await get())
  expect(hero.look).toEqual({ skin: 0, hairStyle: 0, hairColor: 2, eyeStyle: 0, eyeColor: 0, outfit: 5 })
  expect(hero.lookSet).toBe(false)
})

it('shows a new hero with the default look and lookSet false', async () => {
  const { hero } = await bodyOf(await get())
  expect(hero.look).toEqual({ skin: 0, hairStyle: 0, hairColor: 0, eyeStyle: 0, eyeColor: 0, outfit: 0 })
  expect(hero.lookSet).toBe(false)
})

// Review Focus 2: a build change pays the hunt so far with the old build, then hunts on from now.
it('settles a running hunt with the old build before equipping a better weapon', async () => {
  const blade = gear({ rarity: 'legendary', affixes: [{ id: 'sharp', tier: 4, value: 40 }, { id: 'honed', tier: 4, value: 48 }] })
  await saveHero({ items: [blade] })
  await post('/hunt', { world: FOREST, zone: 'z1', difficulty: 'normal' })
  later(30 * MINUTE)
  const preview = (await bodyOf(await get())).huntPreview
  expect(preview.gold).toBeGreaterThan(0)
  const body = await bodyOf(await post('/equip', { itemId: blade.id }))
  expect(body.hero.gold).toBe(preview.gold)
  expect(body.away).toMatchObject({ elapsedMs: 30 * MINUTE, gold: preview.gold, kills: preview.kills })
  expect(body.hero.hunt).toMatchObject({ world: FOREST, zone: 'z1', difficulty: 'normal', startedAt: Date.now(), claims: 1 })
  expect(body.hero.items.find((item) => item.id === blade.id).equipped).toBe('weapon')
})

it('settles a running hunt before a purchase too, and a refused action saves nothing', async () => {
  await saveHero({ gold: 0 })
  await post('/hunt', { world: FOREST, zone: 'z1', difficulty: 'normal' })
  later(10 * MINUTE)
  const preview = (await bodyOf(await get())).huntPreview
  const { version } = await store.getGameHero('alice')
  // The hunt pays for one potion but not for one more than it covers: that refusal keeps the hero
  // (and its hunt) as it was.
  const tooMany = Math.floor(preview.gold / 40) + 1
  expect(tooMany).toBeGreaterThan(1)
  expect(tooMany).toBeLessThanOrEqual(20)
  await refused(await post('/potions/buy', { kind: 'hp', count: tooMany }), M.noGold)
  expect((await store.getGameHero('alice')).version).toBe(version)
  const body = await bodyOf(await post('/potions/buy', { kind: 'hp', count: 1 }))
  expect(body.hero.gold).toBe(preview.gold - 40)
  expect(body.hero.hunt.startedAt).toBe(Date.now())
})

// Review Focus 3: with a full bag the chest's item turns into scrap.
it('salvages the chest item into scrap when the bag is full', async () => {
  await saveHero({ scrap: 5, chests: [{ day: '2026-11-24', boost: 0 }], items: filler(BAG_SIZE) })
  const body = await bodyOf(await post('/chests/open'))
  expect(body.hero.items).toHaveLength(BAG_SIZE)
  expect(body.hero.chests).toEqual([])
  expect(body.overflow.scrap).toBe(salvageValue(body.chest.item).scrap)
  expect(body.hero.scrap).toBe(5 + body.overflow.scrap)
})

it('needs a session for every build action', async () => {
  for (const path of ['/equip', '/talents', '/forge/upgrade', '/chests/open', '/potions/buy']) {
    expect((await api(`/api/game${path}`, { token: null, body: {} })).status).toBe(401)
  }
  expect((await api('/api/game/look', { method: 'PUT', token: null, body: {} })).status).toBe(401)
})
