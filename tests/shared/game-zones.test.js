import { describe, expect, it } from 'vitest'
import { DIFFICULTIES, ELITE_MODS, ENEMIES, SPRITES, enemyFor } from '../../shared/game/enemies.js'
import { createRng } from '../../shared/game/rng.js'
import { HUNT_WORLDS, TIER_STEP, ZONES, ZONE_STEP, zoneDef, zoneState } from '../../shared/game/zones.js'
import { FLORESTA_JS } from '../../shared/world/maps/floresta-js.js'
import { HUB_ID, WORLDS, worldById } from '../../shared/world/worlds.js'

const ids = (list) => list.filter((z) => z.unlocked).map((z) => z.id)
const none = { 'floresta-js': { normal: [], pesadelo: [], inferno: [] } }
const beaten = (normal, pesadelo = []) => ({ 'floresta-js': { normal, pesadelo, inferno: [] } })

describe('enemies data', () => {
  it('has 8+ commons and three bosses per hunt region, every id once', () => {
    expect(ENEMIES.filter((e) => !e.boss).length).toBeGreaterThanOrEqual(8)
    expect(ENEMIES.filter((e) => e.boss).slice(0, 3).map((e) => e.id)).toEqual(['rei-slime', 'aranha-assincrona', 'hidra-undefined'])
    expect(ENEMIES.filter((e) => e.boss)).toHaveLength(3 * HUNT_WORLDS.length)
    expect(new Set(ENEMIES.map((e) => e.id)).size).toBe(ENEMIES.length)
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
  it('hunts every region but the town, the Forest first, with rects from the maps', () => {
    expect(HUNT_WORLDS[0]).toBe('floresta-js')
    expect([...HUNT_WORLDS].sort()).toEqual(WORLDS.filter((world) => world.id !== HUB_ID).map((world) => world.id).sort())
    const z = ZONES['floresta-js']
    // The town's road comes into the Forest from the east: the clearing is there, the roots far west.
    expect(z.z1.rect).toEqual({ x: 32, y: 0, w: 16, h: 32 })
    for (const zone of FLORESTA_JS.zones) expect(z[zone.id].rect).toEqual(zone.rect)
    expect([z.z1.boss, z.z2.boss, z.z3.boss]).toEqual(['rei-slime', 'aranha-assincrona', 'hidra-undefined'])
    for (const world of HUNT_WORLDS) {
      for (const zone of Object.values(ZONES[world])) {
        expect(zone.rect).toEqual(worldById(world).zones.find((each) => each.id === zone.id).rect)
        for (const id of zone.enemies) expect(ENEMIES.find((e) => e.id === id && !e.boss), `${world} ${id}`).toBeTruthy()
        expect(ENEMIES.find((e) => e.id === zone.boss && e.boss), `${world} ${zone.boss}`).toBeTruthy()
      }
    }
  })
  it('gives every region its own enemies and bosses: none is shared with another region', () => {
    const owner = new Map()
    for (const world of HUNT_WORLDS) {
      for (const zone of Object.values(ZONES[world])) {
        for (const id of [...zone.enemies, zone.boss]) {
          expect(owner.get(id) ?? world, id).toBe(world)
          owner.set(id, world)
        }
      }
    }
  })
  it("takes each zone's tier from its region and its numbers from the tier", () => {
    for (const world of HUNT_WORLDS) {
      for (const zone of Object.values(ZONES[world])) expect(zone.tier).toBe(worldById(world).tier)
    }
    expect(ZONES['caverna-sql'].z1).toMatchObject({ tier: 2, minLevel: 20, xp: 1.98 })
    expect(ZONES['torre-matematica'].z3).toMatchObject({ tier: 3, minLevel: 50, bossLevel: 52 })
  })
  it('raises level, item level, boss level and suggested power with every zone and tier', () => {
    for (const field of ['minLevel', 'bossLevel', 'suggestedPower']) {
      for (const [a, b] of [['floresta-js', 'caverna-sql'], ['caverna-sql', 'torre-matematica']]) {
        const ladder = [...Object.values(ZONES[a]), ...Object.values(ZONES[b])].map((zone) => zone[field])
        for (let i = 1; i < ladder.length; i++) expect(ladder[i], `${field} ${a} ${b} ${i}`).toBeGreaterThan(ladder[i - 1])
      }
    }
  })
  it('steps xp ZONE_STEP per zone and TIER_STEP per tier, inside 1.6x to 2x a tier', () => {
    expect(TIER_STEP).toBeGreaterThanOrEqual(1.6)
    expect(TIER_STEP).toBeLessThanOrEqual(2)
    for (const k of ['z1', 'z2', 'z3']) {
      const t1 = ZONES['floresta-js'][k].xp
      const t2 = ZONES['caverna-sql'][k].xp
      const t3 = ZONES['torre-matematica'][k].xp
      for (const ratio of [t2 / t1, t3 / t2]) {
        expect(ratio, k).toBeGreaterThanOrEqual(1.6)
        expect(ratio, k).toBeLessThanOrEqual(2)
      }
    }
    expect(ZONES['floresta-js'].z2.xp / ZONES['floresta-js'].z1.xp).toBeCloseTo(ZONE_STEP, 2)
  })
  it('looks a zone up by own keys only', () => {
    expect(zoneDef('floresta-js', 'z2')).toBe(ZONES['floresta-js'].z2)
    expect(zoneDef('laboratorio', 'z1')).toBeNull()
    expect(zoneDef('floresta-js', 'constructor')).toBeNull()
    expect(zoneDef('__proto__', 'z1')).toBeNull()
    expect(zoneDef(undefined, undefined)).toBeNull()
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
  it('returns nothing for the town, which is not hunted', () => {
    expect(zoneState({}, 'laboratorio', 'normal', 50)).toEqual([])
    expect(zoneState({}, 'caverna-sql', 'normal', 50).map((z) => z.id)).toEqual(['z1', 'z2', 'z3'])
  })
})
