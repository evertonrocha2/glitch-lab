// @vitest-environment node
// Fase 4: fuller hunts. Bigger packs, XP an hour about 30% over fase 3, gold an hour where it was.
import { describe, expect, it } from 'vitest'
import { isElitePack, settleHunt } from '../../shared/game/hunt.js'
import { heroStats } from '../../shared/game/stats.js'
import { HUNT_WORLDS, ZONES } from '../../shared/game/zones.js'

// Fase 3's rates (before the bigger packs), measured with perHour below: a bare hero two levels over
// the zone's suggested level, golpe only, 3 seeds, one hour.
const BEFORE = {
  'floresta-js': { z1: { xp: 595, gold: 2976 }, z2: { xp: 674, gold: 6066 }, z3: { xp: 867, gold: 11099 } },
  'caverna-sql': { z1: { xp: 1199, gold: 4736 }, z2: { xp: 1345, gold: 9912 }, z3: { xp: 1638, gold: 17905 } },
  'torre-matematica': { z1: { xp: 2151, gold: 7443 }, z2: { xp: 2303, gold: 14674 }, z3: { xp: 3086, gold: 28058 } },
}

const bare = (level) => ({ stats: heroStats({ level }), skills: [{ id: 'golpe', level: 1 }], potions: { hp: 0, mp: 0 }, thresholds: { hp: 0.4, mp: 0.25 } })
const perHour = (zone) => {
  const total = { xp: 0, gold: 0, deaths: 0 }
  for (let i = 0; i < 3; i++) {
    const r = settleHunt({ hero: bare(zone.minLevel + 2), zone, difficulty: 'normal', startedAt: 0, now: 3600_000, seed: `ladder:${zone.world}:${zone.id}:${i}`, bagFree: 0 })
    total.xp += r.xp
    total.gold += r.gold
    total.deaths += r.deaths
  }
  return { xp: total.xp / 3, gold: total.gold / 3, deaths: total.deaths / 3 }
}

describe('fuller hunts', () => {
  it('fights packs of 5 to 7, 6 to 8 and 7 to 9 by zone', () => {
    for (const world of HUNT_WORLDS) {
      expect(ZONES[world].z1.pack, world).toEqual([5, 7])
      expect(ZONES[world].z2.pack, world).toEqual([6, 8])
      expect(ZONES[world].z3.pack, world).toEqual([7, 9])
    }
  })

  it('pays about 30% more xp an hour and the same gold in every zone', () => {
    for (const [world, zones] of Object.entries(BEFORE)) {
      for (const [id, before] of Object.entries(zones)) {
        const now = perHour(ZONES[world][id])
        expect(now.xp / before.xp, `${world} ${id} xp`).toBeGreaterThanOrEqual(1.2)
        expect(now.xp / before.xp, `${world} ${id} xp`).toBeLessThanOrEqual(1.4)
        expect(Math.abs(now.gold / before.gold - 1), `${world} ${id} gold`).toBeLessThanOrEqual(0.15)
      }
    }
  })

  it('lets a bare hero two levels over the zone clear the bigger packs, falling at most a few times an hour', () => {
    for (const world of Object.keys(BEFORE)) {
      for (const zone of Object.values(ZONES[world])) expect(perHour(zone).deaths, `${world} ${zone.id}`).toBeLessThanOrEqual(5)
    }
  })
})

describe('isElitePack', () => {
  it('leads every 3rd pack with an elite for 3, as before fase 4', () => {
    const marks = Array.from({ length: 9 }, (_, i) => isElitePack(i, 3))
    expect(marks).toEqual([false, false, true, false, false, true, false, false, true])
  })
  it('spreads a fraction evenly: 1.75 is 4 elites in every 7 packs, 1.25 is 4 in 5', () => {
    const count = (every, n) => Array.from({ length: n }, (_, i) => isElitePack(i, every)).filter(Boolean).length
    expect(count(1.75, 7)).toBe(4)
    expect(count(1.75, 70)).toBe(40)
    expect(count(1.25, 5)).toBe(4)
    expect(count(1, 6)).toBe(6)
  })
})
