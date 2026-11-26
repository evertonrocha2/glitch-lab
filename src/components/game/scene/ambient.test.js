import { describe, expect, it } from 'vitest'
import { ZONES } from '../../../../shared/game/zones.js'
import { canEnter, zoneAt } from '../../../../shared/world/map.js'
import { WORLDS } from '../../../../shared/world/worlds.js'
import { ENEMIES } from '../../../../shared/game/enemies.js'
import { AMBIENT_CAP, AMBIENT_PER_ZONE, CLAIM_RANGE, createAmbient, KEEP_AWAY, NOTICE, REFILL_MS, VIEW_MARGIN } from './ambient.js'

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
  it("places 14 to 18 monsters in each hunt zone, only on walkable tiles inside its rect, from the zone's enemy list", () => {
    expect(AMBIENT_PER_ZONE).toEqual([14, 18])
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
    expect(AMBIENT_CAP).toBe(54)
    for (const world of REGIONS) expect(make(world).monsters().length).toBeLessThanOrEqual(AMBIENT_CAP)
    // Five open zones would want up to 90: the cap holds.
    const rows = Array.from({ length: 20 }, () => '.'.repeat(50))
    const zones = Array.from({ length: 5 }, (_, k) => ({ id: `z${k + 1}`, rect: { x: k * 10, y: 0, w: 10, h: 20 }, enemies: ['slime'] }))
    const wide = { id: 'wide', kind: 'code', rows, zones: zones.map(({ id, rect }) => ({ id, rect })) }
    for (let s = 0; s < 5; s++) expect(createAmbient({ world: wide, zones, seed: s }).monsters().length).toBeLessThanOrEqual(AMBIENT_CAP)
  })

  it('never vanishes or jumps when the hero comes close: a monster near an avoid tile keeps its spot', () => {
    expect(KEEP_AWAY).toBe(4)
    for (const world of REGIONS) {
      const ambient = make(world)
      const before = ambient.monsters().map((m) => ({ id: m.id, x: m.x, y: m.y }))
      // The hero and a pack right on top of where monsters stand, for a long while.
      const avoid = before.slice(0, 3).map((m) => ({ x: m.x, y: m.y }))
      for (let now = 1000; now <= 20000; now += 50) ambient.update(now, avoid)
      const after = new Map(ambient.monsters().map((m) => [m.id, m]))
      expect(after.size, world.id).toBe(before.length)
      for (const m of before) {
        const near = avoid.some((a) => chebyshev(m, a) < KEEP_AWAY)
        if (!near) continue
        const now = after.get(m.id)
        expect({ x: now.x, y: now.y, fade: now.fade }, `${world.id} ${m.id}`).toEqual({ x: m.x, y: m.y, fade: 1 })
      }
    }
  })

  it('turns a monster within KEEP_AWAY to face the hero (the first avoid tile)', () => {
    const world = REGIONS[0]
    const ambient = make(world)
    const m = ambient.monsters()[0]
    ambient.update(1000, [{ x: m.x - 2, y: m.y }])
    expect(ambient.monsters().find((each) => each.id === m.id).facing).toBe(-1)
    ambient.update(1050, [{ x: m.x + 2, y: m.y }])
    expect(ambient.monsters().find((each) => each.id === m.id).facing).toBe(1)
  })

  it('never wanders within KEEP_AWAY tiles of an avoid tile', () => {
    for (const world of REGIONS) {
      const ambient = make(world)
      let now = 0
      for (const zone of Object.values(ZONES[world.id])) {
        const floor = floorOf(world, zone)
        const avoid = [floor[Math.floor(floor.length / 2)], floor[Math.floor(floor.length / 5)]]
        // A step already under way when the avoid tiles moved finishes first.
        for (const end = now + 800; now <= end; now += 50) ambient.update(now, avoid)
        const start = new Map(ambient.monsters().map((m) => [m.id, avoid.every((a) => chebyshev(m, a) >= KEEP_AWAY)]))
        for (const end = now + 15000; now <= end; now += 50) {
          ambient.update(now, avoid)
          for (const m of ambient.monsters()) {
            if (!start.get(m.id)) continue
            const at = { x: Math.round(m.x), y: Math.round(m.y) }
            for (const a of avoid) expect(chebyshev(at, a), `${world.id} ${m.id}`).toBeGreaterThanOrEqual(KEEP_AWAY)
          }
        }
      }
    }
  })

  it('shows each monster with the sprite of its enemy id', () => {
    const sprites = new Map(ENEMIES.map((e) => [e.id, e.sprite]))
    for (const world of REGIONS) {
      for (const m of make(world).monsters()) expect(m.sprite, `${world.id} ${m.enemy}`).toBe(sprites.get(m.enemy))
    }
  })

  it('leaves the open ground walkable: monsters take a small share of it and are never solid', () => {
    for (const world of REGIONS) {
      const list = make(world).monsters()
      for (const zone of Object.values(ZONES[world.id])) {
        const open = floorOf(world, zone).length
        const mine = list.filter((m) => zoneAt(world, m.x, m.y)?.id === zone.id).length
        // Packs of up to 9 plus the hero still find their ground: at most 6% of a zone's floor is taken.
        expect(mine / open, `${world.id} ${zone.id}`).toBeLessThanOrEqual(0.06)
      }
      // Standing on a monster's tile is still standing on floor (the hero walks through them).
      for (const m of list) expect(canEnter(world, m.x, m.y)).toBe(true)
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

// An open 30x20 field in two zones: claims and refills are easy to reason about.
const FIELD = {
  id: 'field',
  kind: 'code',
  rows: Array.from({ length: 20 }, () => '.'.repeat(30)),
  zones: [
    { id: 'z1', rect: { x: 0, y: 0, w: 15, h: 20 } },
    { id: 'z2', rect: { x: 15, y: 0, w: 15, h: 20 } },
  ],
}
const FIELD_ZONES = [
  { id: 'z1', rect: FIELD.zones[0].rect, enemies: ['slime', 'lobo-syntax'] },
  { id: 'z2', rect: FIELD.zones[1].rect, enemies: ['golem-if'] },
]
const field = (extra = {}) => createAmbient({ world: FIELD, zones: FIELD_ZONES, seed: 'field', ...extra })
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const member = (enemy) => ({ enemy, sprite: enemy })
const HERO = { x: 7, y: 10 }
const inZ1 = (m) => zoneAt(FIELD, m.x, m.y)?.id === 'z1'
const nearHero = (list) => list.filter((m) => inZ1(m) && dist(m, HERO) <= CLAIM_RANGE).sort((a, b) => dist(a, HERO) - dist(b, HERO))

describe('claimPack', () => {
  it('hands each member the nearest unclaimed monster of the hero zone, preferring its enemy, and removes it', () => {
    const ambient = field()
    ambient.update(0, [])
    const before = ambient.monsters().map((m) => ({ ...m }))
    const near = nearHero(before)
    expect(near.length).toBeGreaterThanOrEqual(2)
    const want = near[0].enemy
    const claims = ambient.claimPack([member(want), member(want)], HERO)
    expect(claims).toHaveLength(2)
    const same = near.filter((m) => m.enemy === want)
    expect(claims[0]).toMatchObject({ x: same[0].x, y: same[0].y, id: same[0].id, enemy: want })
    for (const c of claims) {
      expect(c).not.toBeNull()
      expect(inZ1(c)).toBe(true)
      expect(dist(c, HERO)).toBeLessThanOrEqual(CLAIM_RANGE)
      expect(c.enemy).toBe(want)
    }
    expect(new Set(claims.map((c) => c.id)).size).toBe(2)
    // Gone from the ambient set at once.
    const left = ambient.monsters()
    expect(left).toHaveLength(before.length - 2)
    for (const c of claims) expect(left.some((m) => m.id === c.id)).toBe(false)
  })

  it('takes the nearest monster when none shows the enemy, switching its look', () => {
    const ambient = field()
    ambient.update(0, [])
    const near = nearHero(ambient.monsters())
    expect(near.length).toBeGreaterThan(0)
    const [claim] = ambient.claimPack([{ enemy: 'mosca-null', sprite: 'mosca-null' }], HERO)
    expect(claim).toMatchObject({ x: near[0].x, y: near[0].y, id: near[0].id, enemy: 'mosca-null', sprite: 'mosca-null' })
  })

  it('gives null to the members left over when the hero zone has too few monsters in range', () => {
    const ambient = field()
    ambient.update(0, [])
    const near = nearHero(ambient.monsters())
    const claims = ambient.claimPack(Array.from({ length: near.length + 3 }, () => member('slime')), HERO)
    expect(claims.filter(Boolean)).toHaveLength(near.length)
    expect(claims.slice(near.length)).toEqual([null, null, null])
    for (const c of claims.filter(Boolean)) expect(inZ1(c)).toBe(true)
    // A hero outside every zone claims nothing.
    expect(ambient.claimPack([member('slime')], { x: 40, y: 40 })).toEqual([null])
  })

  it('refills a claimed slot only after REFILL_MS, on a tile outside the view (with VIEW_MARGIN)', () => {
    const ambient = field()
    ambient.update(0, [])
    const count = () => ambient.monsters().filter(inZ1).length
    const full = count()
    const claims = ambient.claimPack([member('slime'), member('slime')], HERO).filter(Boolean)
    expect(claims.length).toBe(2)
    expect(count()).toBe(full - 2)
    // The camera sees the left 8 columns: a refill lands at x >= 8 + VIEW_MARGIN.
    const view = { x: 0, y: 0, w: 8, h: 20 }
    let now = 0
    for (; now < REFILL_MS - 50; now += 50) ambient.update(now, [HERO], view)
    expect(count()).toBe(full - 2)
    for (; now <= REFILL_MS + 1000; now += 50) ambient.update(now, [HERO], view)
    expect(count()).toBe(full)
    const old = new Set(claims.map((c) => c.id))
    const back = ambient.monsters().filter((m) => old.has(m.id))
    expect(back).toHaveLength(2)
    for (const m of back) {
      expect(m.x).toBeGreaterThanOrEqual(view.x + view.w + VIEW_MARGIN)
      expect(inZ1(m)).toBe(true)
      expect(m.fade).toBe(1)
    }
  })

  it('brings a claimed slot back just past the edge of the view nearest the hero, so strolls find it soon', () => {
    const ambient = field()
    ambient.update(0, [])
    const [claim] = ambient.claimPack([member('slime')], HERO)
    const view = { x: 0, y: 0, w: 8, h: 20 }
    for (let now = 0; now <= REFILL_MS + 600; now += 50) ambient.update(now, [HERO], view)
    const back = ambient.monsters().find((m) => m.id === claim.id)
    expect(back.x).toBeGreaterThanOrEqual(view.x + view.w + VIEW_MARGIN)
    expect(back.x).toBeLessThanOrEqual(view.x + view.w + VIEW_MARGIN + 3)
    expect(Math.abs(back.y - HERO.y)).toBeLessThanOrEqual(3)
  })

  it('waits while the whole zone is in view, and refills once the view moves away', () => {
    const ambient = field()
    ambient.update(0, [])
    const count = () => ambient.monsters().filter(inZ1).length
    const full = count()
    expect(ambient.claimPack([member('slime')], HERO)[0]).not.toBeNull()
    const all = { x: 0, y: 0, w: 15, h: 20 }
    for (let now = 0; now <= REFILL_MS * 3; now += 100) ambient.update(now, [], all)
    expect(count()).toBe(full - 1)
    const away = { x: 0, y: 0, w: 4, h: 20 }
    for (let now = REFILL_MS * 3; now <= REFILL_MS * 4; now += 100) ambient.update(now, [], away)
    expect(count()).toBe(full)
  })

  it('still claims and refills under reducedMotion, and nothing walks', () => {
    const ambient = field({ reducedMotion: true })
    ambient.update(0, [])
    const before = new Map(ambient.monsters().map((m) => [m.id, { x: m.x, y: m.y }]))
    const claims = ambient.claimPack([member('slime'), member('lobo-syntax')], HERO)
    expect(claims.filter(Boolean)).toHaveLength(2)
    for (const c of claims) expect(before.get(c.id)).toEqual({ x: c.x, y: c.y })
    const view = { x: 0, y: 0, w: 8, h: 20 }
    for (let now = 0; now <= REFILL_MS * 2; now += 100) ambient.update(now, [HERO], view)
    expect(ambient.monsters()).toHaveLength(before.size)
    for (const m of ambient.monsters()) {
      expect(m.anim).toBe('idle')
      if (!claims.some((c) => c.id === m.id)) expect({ x: m.x, y: m.y }).toEqual(before.get(m.id))
    }
  })
})

describe('monsters that notice the hero', () => {
  it('drift toward a hero within NOTICE tiles, about a tile a second, and stop KEEP_AWAY short', () => {
    expect(NOTICE).toBe(16)
    const ambient = field()
    ambient.update(0, [])
    const hero = { x: 7, y: 10 }
    const watched = ambient.monsters().filter((m) => inZ1(m) && chebyshev(m, hero) <= NOTICE && chebyshev(m, hero) > KEEP_AWAY + 3)
    expect(watched.length).toBeGreaterThan(0)
    const before = new Map(watched.map((m) => [m.id, chebyshev(m, hero)]))
    for (let now = 0; now <= 4000; now += 50) ambient.update(now, [hero])
    const after = new Map(ambient.monsters().map((m) => [m.id, m]))
    let closer = 0
    for (const [id, d] of before) {
      const m = after.get(id)
      const now = chebyshev({ x: Math.round(m.x), y: Math.round(m.y) }, hero)
      if (now < d) closer++
      // About a tile a second: never more than 5 tiles in 4 s.
      expect(d - now).toBeLessThanOrEqual(5)
    }
    expect(closer / before.size).toBeGreaterThan(0.5)
    for (let now = 4000; now <= 30000; now += 50) ambient.update(now, [hero])
    for (const m of ambient.monsters()) {
      if (!before.has(m.id)) continue
      expect(chebyshev({ x: Math.round(m.x), y: Math.round(m.y) }, hero)).toBeGreaterThanOrEqual(KEEP_AWAY)
    }
    // Most of them now wait near the hero, ready to be the next pack.
    const near = ambient.monsters().filter((m) => before.has(m.id) && dist(m, hero) <= CLAIM_RANGE)
    expect(near.length / before.size).toBeGreaterThan(0.6)
  })

  it("leaves the other zones' monsters to their own wandering", () => {
    const ambient = field()
    ambient.update(0, [])
    const hero = { x: 13, y: 10 }
    const others = ambient.monsters().filter((m) => !inZ1(m) && chebyshev(m, hero) <= NOTICE && chebyshev(m, hero) > KEEP_AWAY)
    expect(others.length).toBeGreaterThan(0)
    const before = others.reduce((sum, m) => sum + dist(m, hero), 0)
    for (let now = 0; now <= 6000; now += 50) ambient.update(now, [hero])
    const after = ambient.monsters().filter((m) => others.some((o) => o.id === m.id))
    // A plain wander moves a tile every 1.5 to 3 s at most: no march toward the hero.
    expect(after.reduce((sum, m) => sum + dist(m, hero), 0)).toBeGreaterThan(before - others.length * 2)
  })

  it('does not drift under reducedMotion', () => {
    const ambient = field({ reducedMotion: true })
    ambient.update(0, [])
    const before = JSON.stringify(ambient.monsters().map((m) => [m.x, m.y]))
    for (let now = 0; now <= 10000; now += 50) ambient.update(now, [{ x: 7, y: 10 }])
    expect(JSON.stringify(ambient.monsters().map((m) => [m.x, m.y]))).toBe(before)
  })
})
