// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { heroLevel, xpForLevel } from '../../shared/game/fuel.js'
import { settleHunt } from '../../shared/game/hunt.js'
import { heroStats } from '../../shared/game/stats.js'
import {
  BOSS_XP_KILLS, ELITE_XP, MULTIPLIER_CAP, bossXp, correctToday, huntXp, levelsGained, startingXp, studyMultiplier,
} from '../../shared/game/xp.js'
import { ZONES } from '../../shared/game/zones.js'

const FOREST = ZONES['floresta-js']

describe('studyMultiplier', () => {
  it('adds 0.1 per acerto today', () => {
    expect(studyMultiplier(0)).toBe(1)
    expect(studyMultiplier(1)).toBe(1.1)
    expect(studyMultiplier(8)).toBe(1.8)
    expect(studyMultiplier(13)).toBe(2.3)
  })
  it('caps at 3.0, reached at 20 acertos', () => {
    expect(MULTIPLIER_CAP).toBe(3)
    expect(studyMultiplier(20)).toBe(3)
    expect(studyMultiplier(21)).toBe(3)
    expect(studyMultiplier(10 ** 6)).toBe(3)
  })
  it('reads junk as no study', () => {
    for (const junk of [-5, Number.NaN, undefined, null, '7']) expect(studyMultiplier(junk), String(junk)).toBe(1)
    // A count is whole: part of an acerto adds nothing.
    expect(studyMultiplier(2.5)).toBe(1.2)
  })
})

describe('correctToday', () => {
  it("reads the ledger row for the client's day, 0 when there is none", () => {
    const ledger = { days: [{ day: '2026-11-25', correct: 4 }, { day: '2026-11-26', correct: 9 }] }
    expect(correctToday(ledger, '2026-11-26')).toBe(9)
    expect(correctToday(ledger, '2026-11-27')).toBe(0)
  })
})

describe('huntXp', () => {
  const z1 = FOREST.z1
  it('pays every kill the zone xp and an elite ELITE_XP times that', () => {
    expect(ELITE_XP).toBe(3)
    expect(huntXp({ kills: 100, elites: 0, zone: z1, difficulty: 'normal' })).toBe(Math.floor(100 * z1.xp))
    expect(huntXp({ kills: 100, elites: 10, zone: z1, difficulty: 'normal' })).toBe(Math.floor(120 * z1.xp))
  })
  it('grows with the zone and the difficulty', () => {
    const kill = (zone, difficulty) => huntXp({ kills: 1000, elites: 0, zone, difficulty })
    expect(kill(FOREST.z2, 'normal')).toBeGreaterThan(kill(z1, 'normal'))
    expect(kill(FOREST.z3, 'normal')).toBeGreaterThan(kill(FOREST.z2, 'normal'))
    expect(kill(z1, 'pesadelo')).toBe(Math.floor(1000 * z1.xp * 3.2))
    expect(kill(z1, 'inferno')).toBe(Math.floor(1000 * z1.xp * 9))
  })
  it('multiplies by the study multiplier and rounds down once', () => {
    const base = huntXp({ kills: 300, elites: 30, zone: z1, difficulty: 'normal' })
    expect(huntXp({ kills: 300, elites: 30, zone: z1, difficulty: 'normal', multiplier: 2 })).toBe(2 * base)
    expect(huntXp({ kills: 300, elites: 30, zone: z1, difficulty: 'normal', multiplier: 1.1 })).toBe(Math.floor(360 * z1.xp * 1.1 + 1e-9))
    expect(huntXp({ kills: 0, elites: 0, zone: z1, difficulty: 'normal', multiplier: 3 })).toBe(0)
  })
})

describe('bossXp', () => {
  it('pays BOSS_XP_KILLS kills of the zone, by difficulty and multiplier', () => {
    expect(bossXp(FOREST.z1, 'normal')).toBe(Math.floor(BOSS_XP_KILLS * FOREST.z1.xp))
    expect(bossXp(FOREST.z2, 'normal', 1.5)).toBe(Math.floor(BOSS_XP_KILLS * FOREST.z2.xp * 1.5))
    expect(bossXp(FOREST.z1, 'pesadelo')).toBeGreaterThan(bossXp(FOREST.z1, 'normal'))
  })
})

describe('startingXp (migration)', () => {
  it('gives a hero without xp the xp its study-derived level implies', () => {
    expect(startingXp({}, 1234)).toBe(1234)
    expect(heroLevel(startingXp({}, xpForLevel(7) + 3)).level).toBe(7)
  })
  it('keeps stored xp, even below what study would give now', () => {
    expect(startingXp({ xp: 0 }, 1234)).toBe(0)
    expect(startingXp({ xp: 500 }, 99)).toBe(500)
  })
  it('replaces junk xp with the study xp', () => {
    for (const xp of [-1, 1.5, '50', null, Number.NaN]) expect(startingXp({ xp }, 77), String(xp)).toBe(77)
  })
})

describe('levelsGained', () => {
  it('counts the levels between two xp totals', () => {
    expect(levelsGained(xpForLevel(5), xpForLevel(5) + 1)).toBe(0)
    expect(levelsGained(xpForLevel(5), xpForLevel(8))).toBe(3)
  })
})

// Balance: a hero with no study and no gear, hunting the zone that fits its level and syncing every
// 5 minutes, goes from level 5 to about 10 in about 2 hours. z2 opens at level 8 (its boss is beaten
// on the way: the sim adds its xp once).
describe('balance', () => {
  const SEGMENT = 5 * 60_000
  function climb(minutes) {
    let xp = xpForLevel(5)
    let bossPaid = false
    for (let t = 0; t < minutes * 60_000; t += SEGMENT) {
      const level = heroLevel(xp).level
      const zone = level >= FOREST.z2.minLevel ? FOREST.z2 : FOREST.z1
      if (zone === FOREST.z2 && !bossPaid) {
        xp += bossXp(FOREST.z1, 'normal')
        bossPaid = true
      }
      const hero = { stats: heroStats({ level }), skills: [{ id: 'golpe', level: 1 }], potions: { hp: 0, mp: 0 }, thresholds: { hp: 0.4, mp: 0.25 } }
      const r = settleHunt({ hero, zone, difficulty: 'normal', startedAt: t, now: t + SEGMENT, seed: `bal:${t}`, bagFree: 60 })
      xp += r.xp
    }
    return heroLevel(xp).level
  }
  it('reaches level 10 in about 2 hours, not in 1 and not after 3', () => {
    expect(climb(60)).toBeLessThan(10)
    expect(climb(120)).toBeGreaterThanOrEqual(9)
    expect(climb(120)).toBeLessThanOrEqual(11)
    expect(climb(180)).toBeGreaterThanOrEqual(10)
  })
})

// Fase 3: every harder area pays more. The regions form one ladder, Forest (tier 1) to the SQL Cave
// (tier 2) to the Math Tower (tier 3), three zones each; the ENEM regions of a tier share its numbers.
describe('the region ladder', () => {
  const CHAIN = ['floresta-js', 'caverna-sql', 'torre-matematica']
  const ladder = CHAIN.flatMap((world) => Object.values(ZONES[world]))
  const bare = (level) => ({ stats: heroStats({ level }), skills: [{ id: 'golpe', level: 1 }], potions: { hp: 0, mp: 0 }, thresholds: { hp: 0.4, mp: 0.25 } })
  // XP an hour for a bare hero two levels over the zone's suggested level, over 3 seeds.
  const perHour = (zone) => {
    let xp = 0
    for (let i = 0; i < 3; i++) xp += settleHunt({ hero: bare(zone.minLevel + 2), zone, difficulty: 'normal', startedAt: 0, now: 3600_000, seed: `ladder:${zone.world}:${zone.id}:${i}`, bagFree: 0 }).xp
    return xp / 3
  }

  it('pays more xp per kill at every step, ordered by suggested level', () => {
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i].minLevel, ladder[i].id).toBeGreaterThan(ladder[i - 1].minLevel)
      expect(ladder[i].xp, `${ladder[i].world} ${ladder[i].id}`).toBeGreaterThan(ladder[i - 1].xp)
    }
  })

  it('pays every ENEM region the xp of the tech region on its tier', () => {
    for (const [enem, tech] of [['biblioteca-linguagens', 'floresta-js'], ['cidade-humanas', 'floresta-js'], ['jardim-natureza', 'caverna-sql']]) {
      for (const k of ['z1', 'z2', 'z3']) expect(ZONES[enem][k].xp).toBe(ZONES[tech][k].xp)
    }
  })

  it('pays more xp an hour at each step for a hero at its suggested level, about 1.6x to 2x a tier', () => {
    const rates = ladder.map(perHour)
    for (let i = 1; i < rates.length; i++) expect(rates[i], `${ladder[i].world} ${ladder[i].id}`).toBeGreaterThan(rates[i - 1])
    for (let k = 0; k < 3; k++) {
      for (const tier of [1, 2]) {
        const ratio = rates[tier * 3 + k] / rates[(tier - 1) * 3 + k]
        expect(ratio, `tier ${tier + 1} z${k + 1}`).toBeGreaterThanOrEqual(1.6)
        expect(ratio, `tier ${tier + 1} z${k + 1}`).toBeLessThanOrEqual(2.1)
      }
    }
  })

  it('keeps a boss first win worth BOSS_XP_KILLS kills of its zone on every tier', () => {
    for (const zone of ladder) expect(bossXp(zone, 'normal')).toBe(Math.floor(BOSS_XP_KILLS * zone.xp + 1e-9))
  })
})
