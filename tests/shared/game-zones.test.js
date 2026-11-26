import { describe, expect, it } from 'vitest'
import { DIFFICULTIES, ELITE_MODS, ENEMIES, SPRITES, enemyFor } from '../../shared/game/enemies.js'
import { createRng } from '../../shared/game/rng.js'
import { HUNT_WORLDS, ZONES, zoneState } from '../../shared/game/zones.js'
import { FLORESTA_JS } from '../../shared/world/maps/floresta-js.js'

const ids = (list) => list.filter((z) => z.unlocked).map((z) => z.id)
const none = { 'floresta-js': { normal: [], pesadelo: [], inferno: [] } }
const beaten = (normal, pesadelo = []) => ({ 'floresta-js': { normal, pesadelo, inferno: [] } })

describe('enemies data', () => {
  it('has 8+ commons and the 3 bosses', () => {
    expect(ENEMIES.filter((e) => !e.boss).length).toBeGreaterThanOrEqual(8)
    expect(ENEMIES.filter((e) => e.boss).map((e) => e.id)).toEqual(['rei-slime', 'aranha-assincrona', 'hidra-undefined'])
    for (const boss of ENEMIES.filter((e) => e.boss)) {
      expect(boss.enrageMs).toBe(90000)
      expect(boss.phases.map((p) => [p.at, p.attackPct])).toEqual([[0.66, 25], [0.33, 25]])
    }
  })
  it('gives each enemy a sprite from the exported list', () => {
    for (const e of ENEMIES) expect(SPRITES).toContain(e.sprite)
  })
  it('has the 6 elite mods and the 3 difficulties', () => {
    expect(ELITE_MODS.map((m) => m.id)).toEqual(expect.arrayContaining(['reflete', 'regenera', 'imune-fogo', 'imune-gelo', 'acelerado', 'blindado']))
    expect(DIFFICULTIES.pesadelo).toEqual({ mult: 3.2, ilvl: 15, rarityBoost: 0.5, minLevel: 25 })
    expect(DIFFICULTIES.inferno.mult).toBe(9)
  })
})

describe('zones data', () => {
  it('hunts only the forest, with rects from the map', () => {
    expect(HUNT_WORLDS).toEqual(['floresta-js'])
    const z = ZONES['floresta-js']
    expect(z.z1.rect).toEqual({ x: 0, y: 0, w: 11, h: 20 })
    expect(z.z2.rect).toEqual(FLORESTA_JS.zones[0].rect)
    expect(z.z3.rect).toEqual(FLORESTA_JS.zones[1].rect)
    expect([z.z1.boss, z.z2.boss, z.z3.boss]).toEqual(['rei-slime', 'aranha-assincrona', 'hidra-undefined'])
    for (const zone of Object.values(z)) for (const id of zone.enemies) expect(ENEMIES.find((e) => e.id === id && !e.boss)).toBeTruthy()
  })
  it('no longer opens the forest zones by the old study rule', () => {
    for (const zone of FLORESTA_JS.zones) expect(zone.requirement ?? null).toBeNull()
  })
})

describe('enemyFor', () => {
  const zone = ZONES['floresta-js'].z2
  it('is deterministic for the same rng seed', () => {
    expect(enemyFor(zone, 'normal', createRng('a'), { elite: true })).toEqual(enemyFor(zone, 'normal', createRng('a'), { elite: true }))
  })
  it('makes elites tougher with 1 to 2 mods', () => {
    expect(enemyFor(zone, 'normal', createRng('s'), {}).mods).toEqual([])
    for (let i = 0; i < 20; i++) {
      const e = enemyFor(zone, 'normal', createRng(`e${i}`), { elite: true })
      expect(e.elite).toBe(true)
      expect(e.mods.length).toBeGreaterThanOrEqual(1)
      expect(e.mods.length).toBeLessThanOrEqual(2)
      expect(new Set(e.mods).size).toBe(e.mods.length)
    }
  })
  it('gives elites 2.5x hp and 1.4x attack over the same enemy', () => {
    const base = ENEMIES.find((e) => e.id === zone.enemies[0]).base
    const plain = enemyFor({ ...zone, enemies: [zone.enemies[0]] }, 'normal', createRng('q'), {})
    const elite = enemyFor({ ...zone, enemies: [zone.enemies[0]] }, 'normal', createRng('q'), { elite: true })
    expect(base.hp).toBeGreaterThan(0)
    expect(elite.base.hp / plain.base.hp).toBeCloseTo(2.5, 1)
    expect(elite.base.attack / plain.base.attack).toBeCloseTo(1.4, 1)
  })
  it('scales pesadelo 3.2x over normal', () => {
    const n = enemyFor(zone, 'normal', createRng('x'), {})
    const p = enemyFor(zone, 'pesadelo', createRng('x'), {})
    expect(p.id).toBe(n.id)
    expect(Math.abs(p.base.hp - 3.2 * n.base.hp)).toBeLessThanOrEqual(1)
    expect(Math.abs(p.base.attack - 3.2 * n.base.attack)).toBeLessThanOrEqual(1)
  })
  it('returns the zone boss with phases', () => {
    const boss = enemyFor(zone, 'normal', createRng('b'), { boss: true })
    expect(boss.id).toBe('aranha-assincrona')
    expect(boss.boss).toBe(true)
    expect(boss.phases).toHaveLength(2)
  })
  it('stays in the zone enemy list', () => {
    for (let i = 0; i < 30; i++) expect(zone.enemies).toContain(enemyFor(zone, 'normal', createRng(i), {}).id)
  })
})

describe('zoneState', () => {
  it('opens every zone of every difficulty for a new level 1 hero', () => {
    for (const difficulty of ['normal', 'pesadelo', 'inferno']) {
      const s = zoneState(none, 'floresta-js', difficulty, 1)
      expect(ids(s)).toEqual(['z1', 'z2', 'z3'])
    }
  })
  it('keeps the zone and boss levels as guidance', () => {
    const s = zoneState(none, 'floresta-js', 'normal', 1)
    expect(s.map((z) => z.id)).toEqual(['z1', 'z2', 'z3'])
    expect(s[1]).toMatchObject({ unlocked: true, minLevel: 8, bossLevel: 10, beaten: false })
  })
  it('opens zone 3 without the bosses before it beaten', () => {
    expect(ids(zoneState(beaten([]), 'floresta-js', 'normal', 7))).toContain('z3')
  })
  it('marks beaten zones', () => {
    expect(zoneState(beaten(['z1']), 'floresta-js', 'normal', 8)[0].beaten).toBe(true)
    expect(zoneState(beaten([], ['z2']), 'floresta-js', 'pesadelo', 1)[1].beaten).toBe(true)
  })
  it('opens pesadelo and inferno before the hidra falls', () => {
    expect(ids(zoneState(beaten(['z1']), 'floresta-js', 'pesadelo', 2))).toEqual(['z1', 'z2', 'z3'])
    expect(ids(zoneState(none, 'floresta-js', 'inferno', 2))).toEqual(['z1', 'z2', 'z3'])
  })
  it('returns nothing for a world that is not hunted', () => {
    expect(zoneState({}, 'caverna-sql', 'normal', 50)).toEqual([])
  })
})
