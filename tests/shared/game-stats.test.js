import { describe, expect, it } from 'vitest'
import { STATS_KEYS } from '../../shared/game/items.js'
import { SKILL_ICONS, SKILLS, skillUpgradeCost } from '../../shared/game/skills.js'
import { baseStats, heroStats, power } from '../../shared/game/stats.js'

// Items resolve through a fake base so each test controls the stats.
const equip = (stat, value) => ({
  items: [{ base: 'fake', upgrade: 0, affixes: [], sockets: [] }],
  bases: [{ id: 'fake', slot: 'ring', stats: { [stat]: value } }],
})

describe('skills', () => {
  it('has 8 unique skills and a free golpe', () => {
    expect(SKILLS).toHaveLength(8)
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(8)
    expect(SKILLS.find((s) => s.id === 'golpe').price).toBe(0)
  })
  it('uses the exact brief values', () => {
    const by = Object.fromEntries(SKILLS.map((s) => [s.id, s]))
    expect(by.golpe).toMatchObject({ element: 'physical', kind: 'hit', power: 1.5, minLevel: 1, mana: 0, cooldownMs: 4000 })
    expect(by.raio).toMatchObject({ element: 'lightning', kind: 'hit', power: 1.8, minLevel: 3, price: 30, mana: 20, cooldownMs: 6000 })
    expect(by.chama).toMatchObject({ element: 'fire', kind: 'dot', power: 0.5, durationMs: 6000, cooldownMs: 8000 })
    expect(by.veneno).toMatchObject({ element: 'poison', kind: 'dot', power: 0.35, durationMs: 10000 })
    expect(by.barreira).toMatchObject({ kind: 'shield', power: 0.2 })
    expect(by.cura).toMatchObject({ kind: 'heal', power: 0.25 })
    expect(by.furia).toMatchObject({ kind: 'buff', power: 0.3, durationMs: 6000 })
    expect(by.nevasca).toMatchObject({ element: 'ice', power: 2.6, slow: 0.3, slowMs: 4000, minLevel: 15, price: 100 })
  })
  it('icons are in the exported icon set', () => {
    for (const s of SKILLS) expect(SKILL_ICONS).toContain(s.icon)
  })
  it('upgrade cost', () => {
    expect(skillUpgradeCost(5)).toBeNull()
    expect(skillUpgradeCost(2).fragments).toBe(80)
  })
})

describe('hero stats', () => {
  it('base stats', () => {
    expect(baseStats(1).hp).toBe(240)
    expect(baseStats(1).attackSpeed).toBe(1)
    for (const k of STATS_KEYS) expect(typeof baseStats(1)[k]).toBe('number')
  })
  it('power is a positive integer that grows with level', () => {
    const p1 = power(baseStats(1))
    expect(Number.isInteger(p1) && p1 > 0).toBe(true)
    expect(power(baseStats(10))).toBeGreaterThan(p1)
  })
  it('equipping attack raises power', () => {
    const a = heroStats({ level: 1, items: [], talents: [] })
    const b = heroStats({ level: 1, ...equip('attack', 20), talents: [] })
    expect(b.attack).toBe(a.attack + 20)
    expect(power(b)).toBeGreaterThan(power(a))
  })
  it('caps dodge at 50', () => {
    expect(heroStats({ level: 1, ...equip('dodge', 80), talents: [] }).dodge).toBe(50)
  })
  it('caps resistances at 75 and crit at 100', () => {
    expect(heroStats({ level: 1, ...equip('resFire', 90), talents: [] }).resFire).toBe(75)
    expect(heroStats({ level: 1, ...equip('critChance', 200), talents: [] }).critChance).toBe(100)
  })
  it('attackPct and hpPct are multiplicative on top of flat', () => {
    const s = heroStats({ level: 1, ...equip('attackPct', 50), talents: [] })
    expect(s.attack).toBe(Math.round(baseStats(1).attack * 1.5))
    expect(s.attackPct).toBe(0)
  })
  it('attackSpeed is a percent on the 1.0 base, for items and talents alike', () => {
    expect(heroStats({ level: 1, ...equip('attackSpeed', -5), talents: [] }).attackSpeed).toBeCloseTo(0.95)
    expect(heroStats({ level: 1, items: [], talents: ['tipagem-forte'] }).attackSpeed).toBeCloseTo(0.85)
    expect(heroStats({ level: 1, ...equip('attackSpeed', 20), talents: [] }).attackSpeed).toBeCloseTo(1.2)
  })
  it('forca-bruta zeroes crit and adds the effect', () => {
    const s = heroStats({ level: 1, items: [], talents: ['forca-bruta'] })
    expect(s.critChance).toBe(0)
    expect(s.effects).toContain('bruteForce')
  })
  it('unions effects from items and talents', () => {
    const items = [{ base: 'anel', unique: 'anel-recursivo', upgrade: 0, affixes: [], sockets: [] }]
    const s = heroStats({ level: 1, items, talents: ['tipagem-forte'] })
    expect(s.effects).toEqual(expect.arrayContaining(['selfCall', 'strongTyping']))
  })
  it('counts socketed gems', () => {
    const items = [{ base: 'espada', upgrade: 0, affixes: [], sockets: ['algoritmos'] }]
    expect(heroStats({ level: 1, items, talents: [] }).critChance).toBe(8)
  })
})
