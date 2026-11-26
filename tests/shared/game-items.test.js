import { describe, it, expect } from 'vitest'
import { createRng } from '../../shared/game/rng.js'
import {
  SLOTS, RARITIES, RARITY_WEIGHTS, AFFIX_COUNT, SOCKETS, BASES, AFFIXES, SETS, UNIQUES, GEMS,
  BAG_SIZE, STATS_KEYS, rollItem, rollGem, itemStats, setBonuses, salvageValue, upgradeCost, rerollCost,
} from '../../shared/game/items.js'

const affixById = Object.fromEntries(AFFIXES.map((a) => [a.id, a]))

describe('game items data', () => {
  it('has the required constants', () => {
    expect(SLOTS).toEqual(['helm', 'amulet', 'ring', 'weapon', 'chest', 'offhand', 'boots', 'relic'])
    expect(RARITIES).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary'])
    expect(RARITY_WEIGHTS.legendary).toBe(0.5)
    expect(AFFIX_COUNT.epic).toBe(3)
    expect(SOCKETS.rare).toEqual([0, 1])
    expect(BAG_SIZE).toBe(60)
    expect(STATS_KEYS).toHaveLength(15)
    expect(GEMS.logica).toEqual({ attackPct: 4 })
  })

  it('has at least 2 bases per slot, with icons and the named bases', () => {
    for (const slot of SLOTS) expect(BASES.filter((b) => b.slot === slot).length).toBeGreaterThanOrEqual(2)
    expect(BASES.length).toBeGreaterThanOrEqual(16)
    for (const b of BASES) expect(b.icon).toMatch(/^[a-z]+(-[a-z]+)*$/)
    expect(BASES.find((b) => b.id === 'espada').stats.attack).toBeGreaterThan(0)
    expect(BASES.find((b) => b.id === 'cajado').stats.magicPct).toBeGreaterThan(0)
    expect(BASES.find((b) => b.id === 'teclado-runico').slot).toBe('relic')
  })

  it('has 24+ affixes with the tier floors and valid stats', () => {
    expect(AFFIXES.length).toBeGreaterThanOrEqual(24)
    for (const a of AFFIXES) {
      expect(STATS_KEYS).toContain(a.stat)
      expect(a.tiers.map((t) => t.minIlvl)).toEqual([1, 10, 20, 35, 50])
      for (const t of a.tiers) expect(t.max).toBeGreaterThanOrEqual(t.min)
    }
  })

  it('has the compilador set and 3 legendary uniques with effects', () => {
    expect(SETS[0].id).toBe('compilador')
    expect(SETS[0].bonus[4]).toEqual({ effect: 'chainBolt' })
    expect(UNIQUES).toHaveLength(3)
    for (const u of UNIQUES) expect(typeof u.effect).toBe('string')
  })
})

describe('rollItem', () => {
  it('is deterministic for the same seed', () => {
    expect(rollItem(createRng('a'), { ilvl: 30 })).toEqual(rollItem(createRng('a'), { ilvl: 30 }))
  })

  it('has the item shape and a 12 hex id', () => {
    const item = rollItem(createRng('shape'), { ilvl: 12 })
    expect(item.id).toMatch(/^[0-9a-f]{12}$/)
    expect(item).toMatchObject({ kind: 'gear', upgrade: 0, rerolls: 0, equipped: null, ilvl: 12 })
    expect(SLOTS).toContain(item.slot)
  })

  it('respects the slot filter', () => {
    const rng = createRng('slot')
    for (let i = 0; i < 50; i++) expect(rollItem(rng, { ilvl: 5, slot: 'ring' }).slot).toBe('ring')
  })

  it('keeps rarity proportions within 3 points over 2000 rolls', () => {
    const rng = createRng('rarity')
    const counts = Object.fromEntries(RARITIES.map((r) => [r, 0]))
    for (let i = 0; i < 2000; i++) counts[rollItem(rng, { ilvl: 10 }).rarity]++
    const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0)
    for (const r of RARITIES) {
      expect(Math.abs((counts[r] / 2000) * 100 - (RARITY_WEIGHTS[r] / total) * 100)).toBeLessThan(3)
    }
  })

  it('rarityBoost raises rare and above', () => {
    const count = (boost) => {
      const rng = createRng('boost')
      let n = 0
      for (let i = 0; i < 1000; i++) if (RARITIES.indexOf(rollItem(rng, { ilvl: 10, rarityBoost: boost }).rarity) >= 2) n++
      return n
    }
    expect(count(2)).toBeGreaterThan(count(0))
  })

  it('has the right affix count, no repeats, and tiers within ilvl', () => {
    const rng = createRng('affix')
    for (let i = 0; i < 500; i++) {
      const ilvl = 1 + rng.int(60)
      const item = rollItem(rng, { ilvl })
      expect(item.affixes).toHaveLength(AFFIX_COUNT[item.rarity])
      expect(new Set(item.affixes.map((a) => a.id)).size).toBe(item.affixes.length)
      for (const a of item.affixes) {
        const tier = affixById[a.id].tiers[a.tier]
        expect(tier.minIlvl).toBeLessThanOrEqual(ilvl)
        expect(a.value).toBeGreaterThanOrEqual(tier.min)
        expect(a.value).toBeLessThanOrEqual(tier.max)
        const slots = affixById[a.id].slots
        if (slots !== 'any') expect(slots).toContain(item.slot)
      }
    }
  })

  it('sockets follow rarity', () => {
    const rng = createRng('sockets')
    for (let i = 0; i < 500; i++) {
      const item = rollItem(rng, { ilvl: 20 })
      const rule = SOCKETS[item.rarity]
      const [lo, hi] = Array.isArray(rule) ? rule : [rule, rule]
      expect(item.sockets.length).toBeGreaterThanOrEqual(lo)
      expect(item.sockets.length).toBeLessThanOrEqual(hi)
      expect(item.sockets.every((s) => s === null)).toBe(true)
    }
  })

  it('can drop set and unique items with consistent fields', () => {
    const rng = createRng('special')
    let sets = 0
    let uniques = 0
    for (let i = 0; i < 4000; i++) {
      const item = rollItem(rng, { ilvl: 40, rarityBoost: 20 })
      if (item.set) {
        sets++
        expect(SETS.find((s) => s.id === item.set).pieces).toContain(item.slot)
      }
      if (item.unique) {
        uniques++
        expect(item.rarity).toBe('legendary')
        expect(UNIQUES.find((u) => u.id === item.unique).slot).toBe(item.slot)
      }
    }
    expect(sets).toBeGreaterThan(0)
    expect(uniques).toBeGreaterThan(0)
  })
})

describe('rollGem', () => {
  it('rolls a gem item', () => {
    const gem = rollGem(createRng('gem'))
    expect(gem.kind).toBe('gem')
    expect(Object.keys(GEMS)).toContain(gem.gem)
    expect(gem.id).toMatch(/^[0-9a-f]{12}$/)
  })
})

describe('itemStats', () => {
  it('scales base stats by upgrade and rounds integers', () => {
    const base = BASES.find((b) => b.stats.attack)
    const stats = itemStats({ base: base.id, upgrade: 0, affixes: [], sockets: [] })
    expect(stats.attack).toBe(base.stats.attack)
    expect(itemStats({ base: base.id, upgrade: 5, affixes: [], sockets: [] }).attack).toBe(
      Math.round(base.stats.attack * 1.3),
    )
  })

  it('upgrade 5 on attack 10 gives 13', () => {
    const bases = [{ id: 'fake', slot: 'weapon', icon: 'sword', minIlvl: 1, stats: { attack: 10 } }]
    expect(itemStats({ base: 'fake', upgrade: 5, affixes: [], sockets: [] }, GEMS, bases).attack).toBe(13)
  })

  it('adds gems', () => {
    const stats = itemStats({ base: 'espada', upgrade: 0, affixes: [], sockets: ['logica', null] })
    expect(stats.attackPct).toBe(4)
  })

  it('adds affixes by the stat from the affix table', () => {
    const a = AFFIXES.find((x) => x.stat === 'critChance')
    const stats = itemStats({ base: 'espada', upgrade: 0, affixes: [{ id: a.id, tier: 0, value: 3 }], sockets: [] })
    expect(stats.critChance).toBeGreaterThanOrEqual(3)
  })
})

describe('setBonuses', () => {
  const piece = (slot) => ({ slot, set: 'compilador' })
  it('gives the 2 piece bonus', () => {
    const r = setBonuses([piece('helm'), piece('chest')])
    expect(r.effects).toEqual([])
    for (const [k, v] of Object.entries(SETS[0].bonus[2])) expect(r[k]).toBe(v)
  })
  it('gives chainBolt at 4 pieces', () => {
    const r = setBonuses([piece('helm'), piece('chest'), piece('boots'), piece('relic')])
    expect(r.effects).toContain('chainBolt')
  })
  it('gives nothing below 2 pieces and includes unique effects', () => {
    expect(setBonuses([piece('helm')]).effects).toEqual([])
    const u = UNIQUES[0]
    expect(setBonuses([{ slot: u.slot, unique: u.id }]).effects).toEqual([u.effect])
  })
})

describe('costs', () => {
  it('salvage', () => {
    expect(salvageValue({ rarity: 'rare', upgrade: 2 })).toEqual({ scrap: 14 })
    expect(salvageValue({ rarity: 'legendary', upgrade: 0 })).toEqual({ scrap: 40 })
  })
  it('upgradeCost', () => {
    expect(upgradeCost({ rarity: 'epic', upgrade: 2 })).toEqual({ gold: 1350, scrap: 15, chance: 0.86 })
    expect(upgradeCost({ rarity: 'epic', upgrade: 10 })).toBeNull()
    expect(upgradeCost({ rarity: 'common', upgrade: 9 }).chance).toBe(0.37)
  })
  it('rerollCost', () => {
    expect(rerollCost({ rerolls: 0 })).toEqual({ gold: 200, fragments: 20 })
    expect(rerollCost({ rerolls: 3 })).toEqual({ gold: 1600, fragments: 20 })
  })
})
