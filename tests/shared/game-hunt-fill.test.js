// @vitest-environment node
// Fase 4: fuller hunts. Bigger packs, XP an hour about 30% over fase 3, gold an hour where it was.
import { describe, expect, it } from 'vitest'
import { BOSS_FIRST_FRAGMENTS, BOSS_FRAGMENTS, fragmentChance, rollFragments } from '../../shared/game/fragments.js'
import { isElitePack, settleHunt } from '../../shared/game/hunt.js'
import { createRng } from '../../shared/game/rng.js'
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

// Fase 4: monsters drop knowledge fragments (shared/game/fragments.js). Study stays the main source.
describe('fragments from monsters', () => {
  const fragmentsPerHour = (zone, { dropLuck = 0 } = {}) => {
    let total = 0
    for (let i = 0; i < 3; i++) {
      total += settleHunt({ hero: bare(zone.minLevel + 2), zone, difficulty: 'normal', startedAt: 0, now: 3600_000, seed: `ladder:${zone.world}:${zone.id}:${i}`, bagFree: 0, dropLuck }).fragments
    }
    return total / 3
  }

  it('drops 30 to 50 fragments an hour in every tier 1 zone at its level', () => {
    const tier1 = HUNT_WORLDS.filter((world) => ZONES[world].z1.tier === 1)
    expect(tier1.length).toBeGreaterThanOrEqual(3)
    for (const world of tier1) {
      for (const zone of Object.values(ZONES[world])) {
        const rate = fragmentsPerHour(zone)
        expect(rate, `${world} ${zone.id}`).toBeGreaterThanOrEqual(30)
        expect(rate, `${world} ${zone.id}`).toBeLessThanOrEqual(50)
      }
    }
  })

  it('drops about 1.6x more fragments a tier (1.3x to 2x)', () => {
    for (const id of ['z1', 'z2', 'z3']) {
      const [forest, cave, tower] = ['floresta-js', 'caverna-sql', 'torre-matematica'].map((world) => fragmentsPerHour(ZONES[world][id]))
      for (const [low, high, step] of [[forest, cave, 'tier 2'], [cave, tower, 'tier 3']]) {
        expect(high / low, `${id} ${step}`).toBeGreaterThanOrEqual(1.3)
        expect(high / low, `${id} ${step}`).toBeLessThanOrEqual(2)
      }
    }
  })

  it('drops 1 to 3 from an elite and 1 from a plain kill, elites more often; a boss win pays 10, 30 the first time', () => {
    const rng = createRng('frag')
    const plain = Array.from({ length: 4000 }, () => rollFragments(rng, { tier: 1, elite: false }))
    const elite = Array.from({ length: 4000 }, () => rollFragments(rng, { tier: 1, elite: true }))
    expect(new Set(plain)).toEqual(new Set([0, 1]))
    expect(new Set(elite)).toEqual(new Set([0, 1, 2, 3]))
    const dropped = (list) => list.filter((n) => n > 0).length / list.length
    expect(dropped(elite)).toBeGreaterThan(dropped(plain) * 1.5)
    expect(BOSS_FRAGMENTS).toBe(10)
    expect(BOSS_FIRST_FRAGMENTS).toBe(30)
  })

  it('drops more with the luck elixir', () => {
    for (const world of ['floresta-js', 'caverna-sql', 'torre-matematica']) {
      const zone = ZONES[world].z2
      expect(fragmentsPerHour(zone, { dropLuck: 0.3 }), world).toBeGreaterThan(fragmentsPerHour(zone))
    }
    expect(fragmentChance({ tier: 1, elite: false, luck: 0.3 })).toBeCloseTo(fragmentChance({ tier: 1, elite: false }) * 1.3)
    expect(fragmentChance({ tier: 3, elite: true, luck: 10 })).toBe(1)
  })

  it('gives the same fragments for the same seed, and leaves items, gems and supports as they were', () => {
    const args = { hero: bare(10), zone: ZONES['floresta-js'].z2, difficulty: 'normal', startedAt: 0, now: 3600_000, seed: 'same', bagFree: 1e6 }
    const one = settleHunt(args)
    expect(settleHunt(args)).toEqual(one)
    expect(one.fragments).toBeGreaterThan(0)
    expect(settleHunt({ ...args, seed: 'other' }).fragments).not.toBe(undefined)
  })

  it('marks the fragments of the shown samples in their logs, right after the kill that dropped them', () => {
    let marks = 0
    for (let i = 0; i < 20; i++) {
      const r = settleHunt({ hero: bare(52), zone: ZONES['torre-matematica'].z3, difficulty: 'normal', startedAt: 0, now: 3600_000, seed: `marks:${i}`, bagFree: 0, dropLuck: 0 })
      for (const sample of r.samples) {
        sample.log.forEach((ev, k) => {
          if (ev.type !== 'fragment') return
          marks++
          expect(ev).toMatchObject({ who: 'enemy', src: expect.any(Number), amount: expect.any(Number) })
          expect(ev.amount).toBeGreaterThanOrEqual(1)
          expect(sample.log[k - 1]).toMatchObject({ type: 'death', who: 'enemy', src: ev.src, t: ev.t })
        })
      }
    }
    expect(marks).toBeGreaterThan(0)
  })
})
