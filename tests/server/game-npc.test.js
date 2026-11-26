// @vitest-environment node
// The NPC economy (fase 3): the merchant, the alchemist's elixirs, the jeweler and the quest board.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ELIXIRS, ELIXIR_MS, elixirPrice } from '../../shared/game/elixirs.js'
import { xpForLevel } from '../../shared/game/fuel.js'
import { GEMS, MAX_POTION_BUY, POTION_PRICE, gemTierScale } from '../../shared/game/items.js'
import { GEM_PRICE, SUPPORT_PRICE, combineCost } from '../../shared/game/jeweler.js'
import { HUNT_KILLS, dailyQuests, questXp } from '../../shared/game/quests.js'
import { STOCK_SIZE, buyPrice, marketRerollCost, marketStock, sellValue } from '../../shared/game/shop.js'
import { bossXp, huntXp } from '../../shared/game/xp.js'
import { ZONES } from '../../shared/game/zones.js'
import { newHero } from '../../server/modules/game/game.model.js'
import { api, useTempStore } from './helpers.js'
import { CASE, SECRET, challengeFor } from './store-contract.js'

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

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = '2026-11-25'
const FOREST = 'floresta-js'
const get = (path = '') => api(`/api/game${path}`, { method: 'GET' })
const post = (path, body) => api(`/api/game${path}`, { body })
const later = (ms) => vi.setSystemTime(new Date(Date.now() + ms))
const saveHero = (patch) => store.saveGameHero('alice', { ...newHero(), xp: 0, ...patch }, 0)
const stored = async () => (await store.getGameHero('alice')).data
const restore = async (patch) => {
  const loaded = await store.getGameHero('alice')
  await store.saveGameHero('alice', { ...loaded.data, ...patch }, loaded.version)
}

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

const M = {
  badItem: "That item can't be used for this.",
  bagFull: 'Your bag is full.',
  noGold: 'Not enough gold.',
  noFragments: 'Not enough knowledge fragments.',
  soldOut: "That piece isn't in the merchant's stock.",
  questNotDone: "This quest isn't done yet.",
  questTaken: 'You already collected this quest.',
  combine: 'Pick 3 gems of the same kind and tier.',
}

let nextId = 0
const gear = (patch = {}) => ({
  id: `item${String(nextId++).padStart(8, '0')}`, kind: 'gear', base: 'anel', slot: 'ring', rarity: 'rare', ilvl: 5,
  affixes: [], sockets: [], upgrade: 0, rerolls: 0, equipped: null, ...patch,
})
const gem = (name = 'logica', tier) => ({ id: `gem${String(nextId++).padStart(9, '0')}`, kind: 'gem', gem: name, ...(tier ? { tier } : {}) })
const filler = (count) => Array.from({ length: count }, () => gear())

// The stock alice sees today at level 1 (tier 1, no rerolls).
const stockToday = (patch = {}) => marketStock({ userId: 'alice', day: DAY, tier: 1, rerolls: 0, level: 1, ...patch })

async function gymPasses(count) {
  for (let index = 0; index < count; index++) {
    const kase = await store.createCase('alice', CASE)
    const challenge = await store.createChallenge('alice', challengeFor(kase.id), SECRET)
    await store.updateChallenge('alice', challenge.id, { status: 'passed', attempts: 1 })
  }
}

it('shows every NPC in the view without saving anything', async () => {
  const body = await bodyOf(await get())
  const { market, alchemist, jeweler, quests } = body.npc
  expect(market).toMatchObject({ day: DAY, tier: 1, ilvl: 1, reroll: marketRerollCost(0), sell: {} })
  expect(market.stock).toHaveLength(STOCK_SIZE)
  expect(market.stock.map((entry) => entry.item)).toEqual(stockToday())
  for (const entry of market.stock) expect(entry.price).toBe(buyPrice(entry.item))
  expect(alchemist.potions).toEqual({ gold: POTION_PRICE, max: MAX_POTION_BUY })
  expect(alchemist.elixirs.map((entry) => entry.type)).toEqual(Object.keys(ELIXIRS))
  expect(jeweler.gems.map((entry) => entry.gem)).toEqual(Object.keys(GEMS))
  expect(quests.day).toBe(DAY)
  expect(quests.quests.map((quest) => quest.id)).toEqual(dailyQuests({ userId: 'alice', day: DAY, level: 1 }).map((quest) => quest.id))
  expect(body.hero.elixirs).toEqual({})
  expect(await store.getGameHero('alice')).toBeNull()
})

it('reads the market of another tier, for a town of the world', async () => {
  await saveHero({ gold: 0 })
  const { market } = await bodyOf(await get('/market?tier=3'))
  expect(market.tier).toBe(3)
  expect(market.ilvl).toBe(21)
  for (const junk of ['0', '7', 'x', '1.5']) expect((await get(`/market?tier=${junk}`)).status).toBe(400)
})

it('buys a stock piece for its price into the bag, once', async () => {
  const [piece] = stockToday()
  await saveHero({ gold: buyPrice(piece) + 5 })
  const body = await bodyOf(await post('/market/buy', { itemId: piece.id }))
  expect(body.bought).toEqual({ item: piece, price: buyPrice(piece) })
  expect(body.hero.gold).toBe(5)
  expect(body.hero.items).toContainEqual(piece)
  expect(body.npc.market.stock.map((entry) => entry.item.id)).not.toContain(piece.id)
  await restore({ gold: 10 ** 6 })
  await refused(await post('/market/buy', { itemId: piece.id }), M.soldOut)
})

it('refuses a buy without the gold, without bag room, or for a piece not in stock', async () => {
  const [piece] = stockToday()
  await saveHero({ gold: buyPrice(piece) - 1 })
  await refused(await post('/market/buy', { itemId: piece.id }), M.noGold)
  await restore({ gold: 10 ** 6, items: filler(60) })
  await refused(await post('/market/buy', { itemId: piece.id }), M.bagFull)
  await restore({ items: [] })
  await refused(await post('/market/buy', { itemId: 'nope' }), M.soldOut)
  for (const body of [{}, { itemId: 5 }, { itemId: piece.id, tier: 9 }]) await refused(await post('/market/buy', body))
  expect((await stored()).gold).toBe(10 ** 6)
})

it('buys from the tier a town passes', async () => {
  const [piece] = stockToday({ tier: 2 })
  await saveHero({ gold: 10 ** 6 })
  const body = await bodyOf(await post('/market/buy', { itemId: piece.id, tier: 2 }))
  expect(body.bought.item).toEqual(piece)
  expect(piece.ilvl).toBe(11)
})

it('restocks on a new day', async () => {
  await saveHero({ gold: 10 ** 6 })
  const [piece] = stockToday()
  await bodyOf(await post('/market/buy', { itemId: piece.id }))
  later(24 * HOUR)
  const body = await bodyOf(await get())
  expect(body.npc.market.day).toBe('2026-11-26')
  expect(body.npc.market.stock.map((entry) => entry.item)).toEqual(marketStock({ userId: 'alice', day: '2026-11-26', tier: 1, level: 1 }))
})

it('rerolls the stock for fragments, doubling the price each time that day', async () => {
  await saveHero({ fragments: 100 })
  const first = await bodyOf(await post('/market/reroll', {}))
  expect(first.hero.fragments).toBe(100 - marketRerollCost(0).fragments)
  expect(first.npc.market.stock.map((entry) => entry.item)).toEqual(stockToday({ rerolls: 1 }))
  expect(first.npc.market.reroll).toEqual(marketRerollCost(1))
  await restore({ fragments: marketRerollCost(1).fragments - 1 })
  await refused(await post('/market/reroll', {}), M.noFragments)
})

it('buys bag gear back, never worn gear or gems', async () => {
  const loose = gear({ rarity: 'epic', ilvl: 8 })
  const other = gear()
  const worn = gear({ equipped: 'ring' })
  const stone = gem()
  await saveHero({ gold: 7, items: [loose, other, worn, stone] })
  const before = await bodyOf(await get())
  expect(before.npc.market.sell).toEqual({ [loose.id]: sellValue(loose), [other.id]: sellValue(other) })
  const body = await bodyOf(await post('/market/sell', { itemIds: [loose.id, other.id] }))
  expect(body.sold).toEqual({ gold: sellValue(loose) + sellValue(other), count: 2 })
  expect(body.hero.gold).toBe(7 + sellValue(loose) + sellValue(other))
  expect(body.hero.items.map((item) => item.id)).toEqual([worn.id, stone.id])
  await refused(await post('/market/sell', { itemIds: [worn.id] }), M.badItem)
  await refused(await post('/market/sell', { itemIds: [stone.id] }), M.badItem)
  for (const junk of [{}, { itemIds: [] }, { itemIds: [worn.id, worn.id] }, { itemIds: 'x' }, { itemIds: ['nope'] }]) {
    await refused(await post('/market/sell', junk))
  }
})

it('buying and selling back never makes gold', async () => {
  await saveHero({ gold: 10 ** 6 })
  for (const piece of stockToday()) {
    const bought = await bodyOf(await post('/market/buy', { itemId: piece.id }))
    const sold = await bodyOf(await post('/market/sell', { itemIds: [piece.id] }))
    expect(sold.hero.gold).toBeLessThan(bought.hero.gold + bought.bought.price)
  }
})

it('keeps the old potion shop and sells potions at the alchemist too', async () => {
  await saveHero({ gold: 200 })
  const old = await bodyOf(await post('/potions/buy', { kind: 'hp', count: 2 }))
  expect(old.hero.potions.hp).toBe(5)
  const body = await bodyOf(await post('/alchemist/potions', { kind: 'mp', count: 3 }))
  expect(body.hero).toMatchObject({ gold: 200 - 5 * POTION_PRICE, potions: { hp: 5, mp: 3 } })
})

it('sells elixirs for gold or fragments, refreshing one already active instead of stacking it', async () => {
  const price = elixirPrice('xp', 1)
  await saveHero({ gold: price.gold, fragments: price.fragments })
  const now = Date.now()
  const first = await bodyOf(await post('/alchemist/elixir', { type: 'xp', currency: 'gold' }))
  expect(first.hero.gold).toBe(0)
  expect(first.hero.elixirs).toEqual({ xp: { startedAt: now, expiresAt: now + ELIXIR_MS } })
  expect(first.elixir).toEqual({ type: 'xp', expiresAt: now + ELIXIR_MS, price: { gold: price.gold } })
  later(10 * MINUTE)
  const again = await bodyOf(await post('/alchemist/elixir', { type: 'xp', currency: 'fragments' }))
  expect(again.hero.fragments).toBe(0)
  expect(again.hero.elixirs.xp.expiresAt).toBe(now + 10 * MINUTE + ELIXIR_MS)
  await refused(await post('/alchemist/elixir', { type: 'luck', currency: 'gold' }), M.noGold)
  await refused(await post('/alchemist/elixir', { type: 'luck', currency: 'fragments' }), M.noFragments)
  for (const junk of [{}, { type: 'speed', currency: 'gold' }, { type: 'xp', currency: 'honor' }, { type: 'constructor', currency: 'gold' }]) {
    await refused(await post('/alchemist/elixir', junk))
  }
})

it('pays hunt xp with the xp elixir for the share of the stretch it covered', async () => {
  const price = elixirPrice('xp', 1)
  await saveHero({ fragments: price.fragments })
  await bodyOf(await post('/hunt', { world: FOREST, zone: 'z1', difficulty: 'normal' }))
  await bodyOf(await post('/alchemist/elixir', { type: 'xp', currency: 'fragments' }))
  later(ELIXIR_MS)
  const full = await bodyOf(await post('/sync'))
  const zone = ZONES[FOREST].z1
  expect(full.away.xp).toBe(huntXp({ kills: full.away.kills, elites: full.away.elites, zone, difficulty: 'normal', multiplier: 1.5 }))
  // Next stretch: an hour, none of it under the elixir.
  later(HOUR)
  const none = await bodyOf(await post('/sync'))
  expect(none.away.xp).toBe(huntXp({ kills: none.away.kills, elites: none.away.elites, zone, difficulty: 'normal' }))
})

it('pays half the bonus when the elixir covered half the stretch', async () => {
  await saveHero({ fragments: 100 })
  await bodyOf(await post('/hunt', { world: FOREST, zone: 'z1', difficulty: 'normal' }))
  await bodyOf(await post('/alchemist/elixir', { type: 'xp', currency: 'fragments' }))
  later(2 * ELIXIR_MS)
  const half = await bodyOf(await post('/sync'))
  expect(half.away.xp).toBe(huntXp({ kills: half.away.kills, elites: half.away.elites, zone: ZONES[FOREST].z1, difficulty: 'normal', multiplier: 1.25 }))
})

it('lets an xp elixir lift the first boss win xp', async () => {
  fuel.level = 30
  const strong = [
    gear({ base: 'espada', slot: 'weapon', rarity: 'legendary', equipped: 'weapon', affixes: [{ id: 'sharp', tier: 4, value: 40 }, { id: 'honed', tier: 4, value: 48 }] }),
    gear({ base: 'armadura', slot: 'chest', rarity: 'legendary', equipped: 'chest', affixes: [{ id: 'vital', tier: 4, value: 170 }, { id: 'fortified', tier: 4, value: 58 }] }),
  ]
  await store.saveGameHero('alice', { ...newHero(), items: strong, fragments: 100, potions: { hp: 20, mp: 0 } }, 0)
  await bodyOf(await post('/alchemist/elixir', { type: 'xp', currency: 'fragments' }))
  const body = await bodyOf(await post('/boss', { world: FOREST, zone: 'z1', difficulty: 'normal' }))
  expect(body.fight.won).toBe(true)
  expect(body.fight.loot.xp).toBe(bossXp(ZONES[FOREST].z1, 'normal', 1.5))
})

it('sells item gems and support gems for fragments at the jeweler', async () => {
  await saveHero({ fragments: GEM_PRICE + SUPPORT_PRICE })
  const first = await bodyOf(await post('/jeweler/buy', { kind: 'gem', id: 'sintaxe' }))
  expect(first.jewel).toMatchObject({ kind: 'gem', gem: 'sintaxe' })
  expect(first.hero.items).toContainEqual(first.jewel)
  expect(first.hero.fragments).toBe(SUPPORT_PRICE)
  const second = await bodyOf(await post('/jeweler/buy', { kind: 'support', id: 'fogo' }))
  expect(second.jewel).toMatchObject({ kind: 'support', support: 'fogo' })
  expect(second.hero.fragments).toBe(0)
  await refused(await post('/jeweler/buy', { kind: 'gem', id: 'logica' }), M.noFragments)
  await restore({ fragments: 1000, items: filler(60) })
  await refused(await post('/jeweler/buy', { kind: 'gem', id: 'logica' }), M.bagFull)
  for (const junk of [{}, { kind: 'gem', id: 'nada' }, { kind: 'support', id: 'logica' }, { kind: 'gear', id: 'espada' }, { kind: 'gem', id: 'constructor' }]) {
    await refused(await post('/jeweler/buy', junk))
  }
})

it('combines 3 gems of one kind and tier into one a tier up, for gold, and the forge sockets it at its tier', async () => {
  const three = [gem('logica'), gem('logica'), gem('logica')]
  const ring = gear({ sockets: [null], equipped: 'ring' })
  await saveHero({ gold: combineCost(1).gold, items: [...three, gem('sintaxe'), ring] })
  const body = await bodyOf(await post('/jeweler/combine', { gemIds: three.map((each) => each.id) }))
  expect(body.combined).toMatchObject({ kind: 'gem', gem: 'logica', tier: 2 })
  expect(body.hero.gold).toBe(0)
  expect(body.hero.items.filter((item) => item.kind === 'gem').map((item) => item.tier ?? 1)).toEqual([1, 2])
  const socketed = await bodyOf(await post('/forge/socket', { itemId: ring.id, gemId: body.combined.id, socket: 0 }))
  expect(socketed.hero.items.find((item) => item.id === ring.id).sockets).toEqual(['logica:2'])
  expect(socketed.stats.attack).toBe(Math.round(body.stats.attack * (1 + (GEMS.logica.attackPct * gemTierScale(2)) / 100)))
})

it('refuses a combine of mixed gems, the wrong count, or without the gold', async () => {
  const mixed = [gem('logica'), gem('logica'), gem('sintaxe')]
  const tiers = [gem('logica'), gem('logica', 2), gem('logica')]
  const good = [gem('algoritmos'), gem('algoritmos'), gem('algoritmos')]
  await saveHero({ gold: combineCost(1).gold - 1, items: [...mixed, ...tiers, ...good] })
  await refused(await post('/jeweler/combine', { gemIds: mixed.map((each) => each.id) }), M.combine)
  await refused(await post('/jeweler/combine', { gemIds: tiers.map((each) => each.id) }), M.combine)
  await refused(await post('/jeweler/combine', { gemIds: good.slice(0, 2).map((each) => each.id) }), M.combine)
  await refused(await post('/jeweler/combine', { gemIds: good.map((each) => each.id) }), M.noGold)
  for (const junk of [{}, { gemIds: 'x' }, { gemIds: [good[0].id, good[0].id, good[1].id] }, { gemIds: ['nope', 'nope2', 'nope3'] }]) {
    await refused(await post('/jeweler/combine', junk))
  }
})

it('counts hunt kills toward the hunt quest and pays it once', async () => {
  await saveHero({})
  const { where } = (await bodyOf(await get())).npc.quests.quests.find((each) => each.id === 'hunt')
  await bodyOf(await post('/hunt', { world: where.world, zone: where.zone, difficulty: 'normal' }))
  await refused(await post('/quests/claim', { questId: 'hunt' }), M.questNotDone)
  later(HOUR)
  const synced = await bodyOf(await post('/sync'))
  expect(synced.away.kills).toBeGreaterThan(HUNT_KILLS)
  const quest = synced.npc.quests.quests.find((each) => each.id === 'hunt')
  expect(quest).toMatchObject({ progress: HUNT_KILLS, done: true, collected: false, where })
  const before = synced.hero
  const body = await bodyOf(await post('/quests/claim', { questId: 'hunt' }))
  expect(body.quest).toMatchObject({ id: 'hunt', reward: quest.reward, chests: 0 })
  expect(body.hero.gold).toBe(before.gold + quest.reward.gold)
  expect(body.hero.fragments).toBe(before.fragments + quest.reward.fragments)
  expect(body.hero.xp).toBe(before.xp + quest.reward.xp)
  expect(body.npc.quests.quests.find((each) => each.id === 'hunt').collected).toBe(true)
  await refused(await post('/quests/claim', { questId: 'hunt' }), M.questTaken)
})

it('reads the acertos quest from the day study, with the study multiplier on its xp', async () => {
  await saveHero({})
  await gymPasses(5)
  const view = await bodyOf(await get())
  const quest = view.npc.quests.quests.find((each) => each.id === 'acertos')
  expect(quest).toMatchObject({ target: 5, progress: 5, done: true })
  const base = dailyQuests({ userId: 'alice', day: DAY, level: 1 }).find((each) => each.id === 'acertos').reward.xp
  expect(quest.reward.xp).toBe(questXp(base, 1.5))
  const body = await bodyOf(await post('/quests/claim', { questId: 'acertos' }))
  expect(body.quest.reward.xp).toBe(questXp(base, 1.5))
})

it('counts a boss win toward the boss quest', async () => {
  vi.setSystemTime(new Date('2026-11-26T12:00:00Z'))
  fuel.level = 30
  const strong = [
    gear({ base: 'espada', slot: 'weapon', rarity: 'legendary', equipped: 'weapon', affixes: [{ id: 'sharp', tier: 4, value: 40 }, { id: 'honed', tier: 4, value: 48 }] }),
    gear({ base: 'armadura', slot: 'chest', rarity: 'legendary', equipped: 'chest', affixes: [{ id: 'vital', tier: 4, value: 170 }, { id: 'fortified', tier: 4, value: 58 }] }),
  ]
  await store.saveGameHero('alice', { ...newHero(), items: strong, potions: { hp: 20, mp: 0 } }, 0)
  const body = await bodyOf(await post('/boss', { world: FOREST, zone: 'z1', difficulty: 'normal' }))
  expect(body.fight.won).toBe(true)
  expect(body.npc.quests.quests.find((each) => each.id === 'boss')).toMatchObject({ progress: 1, done: true })
  const claimed = await bodyOf(await post('/quests/claim', { questId: 'boss' }))
  expect(claimed.quest.id).toBe('boss')
})

it('adds a chest when the last quest of the day is collected', async () => {
  const ids = dailyQuests({ userId: 'alice', day: DAY, level: 1 }).map((quest) => quest.id)
  await saveHero({ quests: { day: DAY, level: 1, kills: {}, bosses: 0, taken: ids.filter((id) => id !== 'acertos') } })
  await gymPasses(5)
  const body = await bodyOf(await post('/quests/claim', { questId: 'acertos' }))
  expect(body.quest.chests).toBe(1)
  expect(body.hero.chests).toContainEqual({ day: DAY, boost: 0 })
  expect(body.npc.quests.bonus.collected).toBe(true)
})

it('starts the quest counters over on a new day, and refuses unknown quests', async () => {
  await saveHero({ quests: { day: DAY, level: 1, kills: { [`${FOREST}/z1`]: 500 }, bosses: 0, taken: ['hunt'] } })
  later(24 * HOUR)
  const body = await bodyOf(await get())
  expect(body.npc.quests.day).toBe('2026-11-26')
  expect(body.npc.quests.quests.find((each) => each.id === 'hunt')).toMatchObject({ progress: 0, collected: false })
  await refused(await post('/quests/claim', { questId: 'daily' }))
  for (const junk of [{}, { questId: 5 }, { questId: 'constructor' }]) await refused(await post('/quests/claim', junk))
})

it('needs a session for every NPC action', async () => {
  for (const path of ['/market/buy', '/market/sell', '/market/reroll', '/alchemist/potions', '/alchemist/elixir', '/jeweler/buy', '/jeweler/combine', '/quests/claim']) {
    expect((await api(`/api/game${path}`, { body: {}, token: null })).status).toBe(401)
  }
  expect((await api('/api/game/market', { method: 'GET', token: null })).status).toBe(401)
})
