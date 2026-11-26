import { describe, expect, it } from 'vitest'
import { createAmbient } from './ambient.js'
import { claimFight } from './claim.js'
import { buildPack, packAt } from './pack.js'
import { rotate } from './placement.js'

// An open 30x20 field in two zones, as in ambient.test.js.
const FIELD = {
  id: 'field',
  kind: 'code',
  rows: Array.from({ length: 20 }, () => '.'.repeat(30)),
  zones: [
    { id: 'z1', rect: { x: 0, y: 0, w: 15, h: 20 } },
    { id: 'z2', rect: { x: 15, y: 0, w: 15, h: 20 } },
  ],
}
const ZONES = [
  { id: 'z1', rect: FIELD.zones[0].rect, enemies: ['slime', 'lobo-syntax'] },
  { id: 'z2', rect: FIELD.zones[1].rect, enemies: ['golem-if'] },
]
const RECT = FIELD.zones[0].rect
const HERO = { x: 7, y: 10 }
const SPREAD = 1.6

const spawn = (src, extra = {}) => ({ t: 0, who: 'enemy', src, type: 'spawn', id: 'slime', sprite: 'slime', hp: 100, from: { x: 4, y: 0 }, to: { x: 1.3, y: 0 }, speed: 2.5, ...extra })
const packOf = (spawns) => buildPack({ ms: 3000, log: [...spawns, ...spawns.map((s) => ({ t: 1200, who: 'enemy', src: s.src, type: 'arrive' }))] }, { speed: 1 })
// Where the scene draws foe i at ms: the hero tile plus its turned, spread offset.
const drawn = (fight, i, ms) => {
  const f = packAt(fight.pack, ms).foes[i]
  const r = rotate(fight.rot, f, { x: 0, y: 0 })
  return { x: HERO.x + r.x * SPREAD, y: HERO.y + r.y * SPREAD }
}

describe('claimFight', () => {
  it('makes the pack of the monsters nearest the hero: each claimed foe appears where its monster stood', () => {
    for (const reducedMotion of [false, true]) {
      const ambient = createAmbient({ world: FIELD, zones: ZONES, seed: 'field', reducedMotion })
      ambient.update(0, [])
      const before = new Map(ambient.monsters().map((m) => [m.id, { x: m.x, y: m.y }]))
      const pack = packOf([spawn(0), spawn(1, { id: 'lobo-syntax', sprite: 'lobo-syntax', from: { x: 3.3, y: 2.3 }, to: { x: 1.1, y: 0.7 } })])
      const fight = claimFight({ ambient, pack, world: FIELD, rect: RECT, tile: HERO, spread: SPREAD })
      expect(fight.claims.filter(Boolean)).toHaveLength(2)
      for (const [i, c] of fight.claims.entries()) {
        expect(before.get(c.id)).toEqual({ x: c.x, y: c.y })
        const at = drawn(fight, i, 0)
        expect(at.x).toBeCloseTo(c.x)
        expect(at.y).toBeCloseTo(c.y)
        expect(fight.pack.foes[i].claimed).toBe(true)
        // It still stops where the log says.
        expect(fight.pack.foes[i].to).toEqual(pack.foes[i].to)
      }
      // The claimed monsters left the ambient set.
      expect(ambient.monsters()).toHaveLength(before.size - 2)
    }
  })

  it('keeps the log spawn for the foes left over, and for bosses and their adds', () => {
    const ambient = createAmbient({ world: FIELD, zones: ZONES, seed: 'field' })
    ambient.update(0, [])
    const pack = packOf([spawn(0, { boss: true, sprite: 'rei-slime', id: 'rei-slime' }), spawn(1, { summoner: 0 }), spawn(2)])
    const fight = claimFight({ ambient, pack, world: FIELD, rect: RECT, tile: HERO, spread: SPREAD })
    expect(fight.claims[0]).toBeNull()
    expect(fight.claims[1]).toBeNull()
    expect(fight.claims[2]).not.toBeNull()
    expect(fight.pack.foes[0].from).toEqual(pack.foes[0].from)
    expect(fight.pack.foes[1].from).toEqual(pack.foes[1].from)
  })

  it('plays the pack as logged with no ambient monsters (the town, a test)', () => {
    const pack = packOf([spawn(0)])
    const fight = claimFight({ ambient: null, pack, world: FIELD, rect: RECT, tile: HERO, spread: SPREAD })
    expect(fight.pack).toBe(pack)
    expect(fight.claims).toEqual([null])
  })
})
