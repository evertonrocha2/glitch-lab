import { describe, expect, it } from 'vitest'
import { GEMS, GEM_MAX_TIER, gemStats, gemTierOf, gemTierScale, itemStats, parseSocket, socketValue } from '../../shared/game/items.js'
import { COMBINE_COUNT, GEM_PRICE, SUPPORT_PRICE, combineCost, combinable, combinedGem, jewelerView } from '../../shared/game/jeweler.js'
import { SUPPORT_IDS } from '../../shared/game/skill-mods.js'

const gem = (name, tier, id = `g${name}${tier}${Math.random()}`) => ({ id, kind: 'gem', gem: name, ...(tier ? { tier } : {}) })

describe('gem tiers', () => {
  it('reads a gem without a tier (every gem saved before tiers) as tier 1, and junk as tier 1', () => {
    expect(gemTierOf({ kind: 'gem', gem: 'logica' })).toBe(1)
    expect(gemTierOf({ kind: 'gem', gem: 'logica', tier: 3 })).toBe(3)
    for (const junk of [0, -1, 2.5, '2', GEM_MAX_TIER + 1, null]) expect(gemTierOf({ gem: 'logica', tier: junk }), String(junk)).toBe(1)
  })

  it('scales stats up with each tier, but less than the 3 gems a combine eats', () => {
    expect(gemTierScale(1)).toBe(1)
    for (let tier = 1; tier < GEM_MAX_TIER; tier++) {
      expect(gemTierScale(tier + 1)).toBeGreaterThan(gemTierScale(tier))
      expect(gemTierScale(tier + 1)).toBeLessThan(COMBINE_COUNT * gemTierScale(tier))
    }
    expect(gemStats('logica', 1)).toEqual(GEMS.logica)
    expect(gemStats('logica', 2).attackPct).toBeCloseTo(GEMS.logica.attackPct * gemTierScale(2))
    expect(gemStats('nada', 2)).toEqual({})
    expect(gemStats('constructor', 1)).toEqual({})
  })

  it("keeps a tier 1 socket as the plain gem id, so old items read the same, and writes 'gem:tier' above it", () => {
    expect(socketValue(gem('logica'))).toBe('logica')
    expect(socketValue(gem('sintaxe', 3))).toBe('sintaxe:3')
    expect(parseSocket('logica')).toEqual({ gem: 'logica', tier: 1 })
    expect(parseSocket('sintaxe:3')).toEqual({ gem: 'sintaxe', tier: 3 })
    for (const junk of [null, '', 'nada', 'logica:0', 'logica:9', 'logica:x', 'constructor', 42]) expect(parseSocket(junk), String(junk)).toBeNull()
  })

  it('adds a socketed gem stats at its tier to the item', () => {
    const item = { kind: 'gear', base: 'anel', slot: 'ring', rarity: 'epic', ilvl: 1, affixes: [], sockets: ['logica:3', 'sintaxe'], upgrade: 0 }
    const stats = itemStats(item)
    expect(stats.attackPct).toBeCloseTo(GEMS.logica.attackPct * gemTierScale(3), 1)
    expect(stats.hpPct).toBe(GEMS.sintaxe.hpPct)
    expect(itemStats({ ...item, sockets: ['junk:2', null] }).attackPct).toBeUndefined()
  })
})

describe('the jeweler', () => {
  it('sells a tier 1 item gem of your pick and any support gem for knowledge fragments', () => {
    expect(GEM_PRICE).toBeGreaterThan(0)
    expect(SUPPORT_PRICE).toBeGreaterThan(GEM_PRICE)
    const view = jewelerView()
    expect(view.gems.map((entry) => entry.gem)).toEqual(Object.keys(GEMS))
    expect(view.supports.map((entry) => entry.support)).toEqual(SUPPORT_IDS)
    for (const entry of [...view.gems, ...view.supports]) expect(entry.fragments).toBeGreaterThan(0)
    expect(view.combine.count).toBe(COMBINE_COUNT)
  })

  it('combines exactly 3 gems of one kind and one tier, below the top tier', () => {
    expect(combinable([gem('logica'), gem('logica', 1), gem('logica')])).toEqual({ gem: 'logica', tier: 1 })
    expect(combinable([gem('algoritmos', 2), gem('algoritmos', 2), gem('algoritmos', 2)])).toEqual({ gem: 'algoritmos', tier: 2 })
    expect(combinable([gem('logica'), gem('logica')])).toBeNull()
    expect(combinable([gem('logica'), gem('logica'), gem('logica'), gem('logica')])).toBeNull()
    expect(combinable([gem('logica'), gem('logica'), gem('sintaxe')])).toBeNull()
    expect(combinable([gem('logica'), gem('logica', 2), gem('logica')])).toBeNull()
    const top = Array.from({ length: 3 }, () => gem('logica', GEM_MAX_TIER))
    expect(combinable(top)).toBeNull()
    const supports = Array.from({ length: 3 }, (_, at) => ({ id: `s${at}`, kind: 'support', support: 'fogo' }))
    expect(combinable(supports)).toBeNull()
  })

  it('makes one gem a tier higher, for a gold fee that grows with the tier', () => {
    expect(combinedGem('abc', { gem: 'logica', tier: 2 })).toEqual({ id: 'abc', kind: 'gem', gem: 'logica', tier: 3 })
    for (let tier = 1; tier < GEM_MAX_TIER - 1; tier++) expect(combineCost(tier + 1).gold).toBeGreaterThan(combineCost(tier).gold)
    expect(combineCost(GEM_MAX_TIER)).toBeNull()
  })
})
