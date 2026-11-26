// @vitest-environment node
import { expect, it } from 'vitest'
import { settleHunt } from '../../shared/game/hunt.js'
import { zoneRates } from '../../shared/game/rates.js'
import { heroStats } from '../../shared/game/stats.js'
import { ZONES } from '../../shared/game/zones.js'

const fighter = (level) => ({ stats: heroStats({ level }), skills: [{ id: 'golpe', level: 1 }], potions: { hp: 0, mp: 0 }, thresholds: { hp: 0.4, mp: 0.25 } })

it('is exactly what one hour of the server settle pays, at the study multiplier', () => {
  const zone = ZONES['caverna-sql'].z1
  const rates = zoneRates({ fighter: fighter(22), zone, multiplier: 1.5 })
  const hour = settleHunt({ hero: fighter(22), zone, difficulty: 'normal', startedAt: 0, now: 3600_000, seed: 'rates:caverna-sql:z1:normal', bagFree: 0, xpMultiplier: 1.5 })
  expect(rates).toEqual({ xp: hour.xp, gold: hour.gold, kills: hour.kills, deaths: hour.deaths })
  expect(rates.xp).toBeGreaterThan(0)
})

it('gives the same answer twice and changes with the build and the difficulty', () => {
  const zone = ZONES['floresta-js'].z2
  const a = zoneRates({ fighter: fighter(10), zone })
  expect(zoneRates({ fighter: fighter(10), zone })).toBe(a)
  expect(zoneRates({ fighter: fighter(14), zone }).xp).toBeGreaterThan(a.xp * 0.9)
  expect(zoneRates({ fighter: fighter(10), zone, difficulty: 'pesadelo' })).not.toEqual(a)
})

it('pays a hopeless hero next to nothing in a tier 3 zone', () => {
  const rates = zoneRates({ fighter: fighter(1), zone: ZONES['torre-matematica'].z3 })
  expect(rates.xp).toBeLessThan(50)
  expect(rates.deaths).toBeGreaterThan(0)
})
