import { describe, expect, it } from 'vitest'
import { createAmbient } from './ambient.js'
import { claimFight, WALK_IN_STRETCH } from './claim.js'
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

describe('claimFight: members with no monster walk in from just off screen', () => {
  const pack = packOf([spawn(0)])
  // On screen: the logged walk (from 4 to 1.3, spread) is this long.
  const logged = (4 - 1.3) * SPREAD
  const outside = (v, p) => p.x < v.x - 1 || p.x >= v.x + v.w + 1 || p.y < v.y - 1 || p.y >= v.y + v.h + 1
  const ambient = () => {
    const a = createAmbient({ world: FIELD, zones: ZONES, seed: 'field' })
    a.claimPack(Array.from({ length: 40 }, () => ({ enemy: 'slime' })), HERO)
    return a
  }

  it('starts it just past the nearest edge of the view when that walk is at most WALK_IN_STRETCH times the logged one', () => {
    expect(WALK_IN_STRETCH).toBe(1.5)
    const view = { x: 3, y: 7, w: 10, h: 6 }
    const fight = claimFight({ ambient: ambient(), pack, world: FIELD, rect: RECT, tile: HERO, spread: SPREAD, view })
    expect(fight.claims).toEqual([null])
    expect(fight.edges).toEqual([true])
    const start = drawn(fight, 0, 0)
    const stop = drawn(fight, 0, 1200)
    expect(outside(view, start)).toBe(true)
    expect(Math.hypot(start.x - stop.x, start.y - stop.y)).toBeLessThanOrEqual(logged * WALK_IN_STRETCH + 1e-6)
    // It stands on floor of the hunted zone, so nothing pulls it onto the screen.
    expect(start.x).toBeGreaterThanOrEqual(RECT.x)
    expect(start.x).toBeLessThan(RECT.x + RECT.w)
    expect(Number.isInteger(Math.round(start.x * 1e6) / 1e6)).toBe(true)
    // No portal for it.
    expect(fight.pack.fx.filter((fx) => fx.kind === 'spawn')).toEqual([])
  })

  it('keeps the portal when every edge in the zone is too far for a believable walk', () => {
    // Only the top edge is in the zone, 10 tiles up: a dash. The rest of the view runs off the zone.
    const view = { x: -3, y: 1, w: 21, h: 18 }
    const fight = claimFight({ ambient: ambient(), pack, world: FIELD, rect: RECT, tile: HERO, spread: SPREAD, view })
    expect(fight.edges).toEqual([false])
    expect(fight.pack.foes[0].from).toEqual(pack.foes[0].from)
    expect(fight.pack.fx.filter((fx) => fx.kind === 'spawn')).toHaveLength(1)
  })

  it('keeps the log when its spawn is already off screen, and without a view', () => {
    const tiny = { x: 6, y: 9, w: 3, h: 2 }
    const off = claimFight({ ambient: ambient(), pack, world: FIELD, rect: RECT, tile: HERO, spread: SPREAD, view: tiny })
    expect(off.edges).toEqual([false])
    expect(off.pack.foes[0].from).toEqual(pack.foes[0].from)
    const none = claimFight({ ambient: ambient(), pack, world: FIELD, rect: RECT, tile: HERO, spread: SPREAD })
    expect(none.edges).toEqual([false])
  })

  it('never walks a boss or its adds in from the edge', () => {
    const boss = packOf([spawn(0, { boss: true, sprite: 'rei-slime', id: 'rei-slime' }), spawn(1, { summoner: 0 })])
    const view = { x: 3, y: 7, w: 10, h: 6 }
    const fight = claimFight({ ambient: ambient(), pack: boss, world: FIELD, rect: RECT, tile: HERO, spread: SPREAD, view })
    expect(fight.edges).toEqual([false, false])
  })
})
