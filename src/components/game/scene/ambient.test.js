import { describe, expect, it } from 'vitest'
import { ZONES } from '../../../../shared/game/zones.js'
import { canEnter, zoneAt } from '../../../../shared/world/map.js'
import { WORLDS } from '../../../../shared/world/worlds.js'
import { AMBIENT_CAP, AMBIENT_PER_ZONE, createAmbient, KEEP_AWAY } from './ambient.js'

const REGIONS = WORLDS.filter((world) => ZONES[world.id])
const TOWN = WORLDS.find((world) => world.kind === 'town')
const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
const make = (world, extra = {}) => createAmbient({ world, zones: ZONES[world.id], seed: `ambient/${world.id}`, ...extra })

// Every walkable tile of a zone, to stand avoid tiles on.
function floorOf(world, zone) {
  const out = []
  for (let y = zone.rect.y; y < zone.rect.y + zone.rect.h; y++) {
    for (let x = zone.rect.x; x < zone.rect.x + zone.rect.w; x++) if (canEnter(world, x, y) && zoneAt(world, x, y)?.id === zone.id) out.push({ x, y })
  }
  return out
}

describe('createAmbient', () => {
  it("places 6 to 10 monsters in each hunt zone, only on walkable tiles inside its rect, from the zone's enemy list", () => {
    expect(AMBIENT_PER_ZONE).toEqual([6, 10])
    for (const world of REGIONS) {
      const list = make(world).monsters()
      for (const zone of Object.values(ZONES[world.id])) {
        const mine = list.filter((m) => zoneAt(world, m.x, m.y)?.id === zone.id)
        expect(mine.length, `${world.id} ${zone.id}`).toBeGreaterThanOrEqual(AMBIENT_PER_ZONE[0])
        expect(mine.length, `${world.id} ${zone.id}`).toBeLessThanOrEqual(AMBIENT_PER_ZONE[1])
        for (const m of mine) {
          expect(Number.isInteger(m.x) && Number.isInteger(m.y)).toBe(true)
          expect(canEnter(world, m.x, m.y), `${world.id} ${m.x},${m.y}`).toBe(true)
          expect(zone.enemies).toContain(m.enemy)
        }
      }
      // Two never share a tile.
      expect(new Set(list.map((m) => `${m.x},${m.y}`)).size).toBe(list.length)
      expect(new Set(list.map((m) => m.id)).size).toBe(list.length)
    }
  })

  it('never has more than AMBIENT_CAP monsters on a map', () => {
    expect(AMBIENT_CAP).toBe(30)
    for (const world of REGIONS) expect(make(world).monsters().length).toBeLessThanOrEqual(AMBIENT_CAP)
    // Five open zones would want up to 50: the cap holds.
    const rows = Array.from({ length: 20 }, () => '.'.repeat(50))
    const zones = Array.from({ length: 5 }, (_, k) => ({ id: `z${k + 1}`, rect: { x: k * 10, y: 0, w: 10, h: 20 }, enemies: ['slime'] }))
    const wide = { id: 'wide', kind: 'code', rows, zones: zones.map(({ id, rect }) => ({ id, rect })) }
    for (let s = 0; s < 5; s++) expect(createAmbient({ world: wide, zones, seed: s }).monsters().length).toBeLessThanOrEqual(AMBIENT_CAP)
  })

  it('keeps every monster at least KEEP_AWAY tiles (Chebyshev) from each avoid tile after update', () => {
    expect(KEEP_AWAY).toBe(4)
    for (const world of REGIONS) {
      const ambient = make(world)
      // Stand the hero and a pack right on top of where monsters are, then walk around the zones.
      const start = ambient.monsters().slice(0, 3).map((m) => ({ x: m.x, y: m.y }))
      let now = 1000
      ambient.update(now, start)
      for (const m of ambient.monsters()) for (const a of start) expect(chebyshev(m, a), `${world.id} ${m.id}`).toBeGreaterThanOrEqual(KEEP_AWAY)
      for (const zone of Object.values(ZONES[world.id])) {
        const floor = floorOf(world, zone)
        for (let i = 0; i < floor.length; i += 7) {
          const avoid = [floor[i], floor[(i + 3) % floor.length], floor[(i + 11) % floor.length]]
          now += 400
          ambient.update(now, avoid)
          for (const m of ambient.monsters()) for (const a of avoid) expect(chebyshev(m, a), `${world.id} ${m.id}`).toBeGreaterThanOrEqual(KEEP_AWAY)
        }
      }
    }
  })

  it('wanders a tile now and then, inside its zone', () => {
    const world = REGIONS[0]
    const ambient = make(world)
    const before = ambient.monsters().map((m) => ({ id: m.id, x: m.x, y: m.y, zone: zoneAt(world, m.x, m.y).id }))
    for (let now = 0; now <= 20000; now += 50) ambient.update(now, [])
    const after = ambient.monsters()
    expect(after.some((m, i) => m.x !== before[i].x || m.y !== before[i].y)).toBe(true)
    for (const [i, m] of after.entries()) {
      const x = Math.round(m.x)
      const y = Math.round(m.y)
      expect(canEnter(world, x, y)).toBe(true)
      expect(zoneAt(world, x, y)?.id).toBe(before[i].zone)
    }
  })

  it('does not move under reducedMotion', () => {
    for (const world of REGIONS) {
      const ambient = make(world, { reducedMotion: true })
      const before = JSON.stringify(ambient.monsters())
      for (let now = 0; now <= 30000; now += 100) ambient.update(now, [])
      const after = ambient.monsters()
      expect(JSON.stringify(after)).toBe(before)
      for (const m of after) expect(m.anim).toBe('idle')
    }
  })

  it('gives the same placement for the same seed', () => {
    for (const world of REGIONS) {
      const a = make(world).monsters()
      const b = make(world).monsters()
      expect(b).toEqual(a)
      const c = createAmbient({ world, zones: ZONES[world.id], seed: 'another seed' }).monsters()
      expect(c).not.toEqual(a)
    }
  })

  it('has no monsters in the town', () => {
    expect(TOWN).toBeTruthy()
    const ambient = createAmbient({ world: TOWN, zones: ZONES[TOWN.id], seed: 1 })
    ambient.update(1000, [])
    expect(ambient.monsters()).toEqual([])
    // Not even when handed a region's zones.
    expect(createAmbient({ world: TOWN, zones: ZONES[REGIONS[0].id], seed: 1 }).monsters()).toEqual([])
  })
})
