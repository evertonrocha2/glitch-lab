import { describe, expect, it } from 'vitest'
import { GEM_SALVAGE_SCRAP, MAX_HUNT_MS, SAMPLE_FIGHTS, settleHunt } from '../../shared/game/hunt.js'
import { salvageValue } from '../../shared/game/items.js'
import { heroStats } from '../../shared/game/stats.js'
import { huntXp } from '../../shared/game/xp.js'
import { ZONES } from '../../shared/game/zones.js'

const FOREST = ZONES['floresta-js']
const hero = (level, potions = { hp: 0, mp: 0 }) => ({
  stats: heroStats({ level }),
  skills: [{ id: 'golpe', level: 1 }],
  potions,
  thresholds: { hp: 0.4, mp: 0.2 },
})
const HOUR = 3600_000
const run = (over = {}) => settleHunt({
  hero: hero(20), zone: FOREST.z1, difficulty: 'normal', startedAt: 0, now: HOUR, seed: 'h', bagFree: 60, ...over,
})

describe('settleHunt', () => {
  it('exports the brief constants', () => {
    expect(MAX_HUNT_MS).toBe(8 * HOUR)
    expect(SAMPLE_FIGHTS).toBe(12)
  })
  it('gives a deep-equal result for the same inputs', () => {
    expect(run()).toEqual(run())
  })
  it('pays 10 hours the same as 8 hours', () => {
    const long = run({ now: 10 * HOUR })
    expect(long.elapsedMs).toBe(MAX_HUNT_MS)
    expect(long).toEqual(run({ now: 8 * HOUR }))
  })
  it('pays 0 kills for a future startedAt', () => {
    const r = run({ startedAt: 5 * HOUR, now: HOUR })
    expect(r.elapsedMs).toBe(0)
    expect(r.kills).toBe(0)
    expect(r.items).toEqual([])
  })
  it('roughly doubles kills when elapsed doubles', () => {
    const one = run({ now: HOUR }).kills
    const two = run({ now: 2 * HOUR }).kills
    expect(one).toBeGreaterThan(50)
    expect(Math.abs(two - 2 * one)).toBeLessThanOrEqual(1)
  })
  it('returns the first 3 samples and a gold payout', () => {
    const r = run()
    expect(r.samples).toHaveLength(3)
    expect(r.gold).toBeGreaterThan(0)
    expect(r.kills + r.deaths).toBeGreaterThan(0)
  })
  it('keeps no items but salvages them when the bag is full', () => {
    const r = run({ bagFree: 0, now: 4 * HOUR })
    expect(r.items).toEqual([])
    expect(r.scrapFromOverflow).toBeGreaterThan(0)
  })
  it('shares the bag between items and gems', () => {
    const r = run({ bagFree: 5, now: 8 * HOUR })
    expect(r.items.length + r.gems.length).toBeLessThanOrEqual(5)
  })
  it('returns no gems with bagFree 0 and scraps them too', () => {
    const open = run({ bagFree: 1e6, now: 8 * HOUR })
    const shut = run({ bagFree: 0, now: 8 * HOUR })
    expect(open.gems.length).toBeGreaterThan(0)
    expect(shut.gems).toEqual([])
    expect(shut.items).toEqual([])
    const itemScrap = open.items.reduce((sum, item) => sum + salvageValue(item).scrap, 0)
    expect(shut.scrapFromOverflow).toBe(itemScrap + open.gems.length * GEM_SALVAGE_SCRAP)
  })
  it('drops fewer kills once the potion stock runs out', () => {
    const base = { hero: hero(8, { hp: 1, mp: 1 }), zone: FOREST.z2, now: 8 * HOUR }
    const rich = run({ ...base, hero: hero(8, { hp: 1e6, mp: 1e6 }) })
    const poor = run(base)
    expect(rich.kills).toBeGreaterThan(poor.kills)
  })
  it('caps items at bagFree', () => {
    const r = run({ bagFree: 3, now: 4 * HOUR })
    expect(r.items).toHaveLength(3)
  })
  it('gives a hopeless hero no kills and some deaths', () => {
    const r = run({ hero: hero(1), zone: FOREST.z3, difficulty: 'inferno' })
    expect(r.kills).toBe(0)
    expect(r.deaths).toBeGreaterThan(0)
    expect(r.gold).toBe(0)
  })
  it('pays xp for its kills, elites worth more, times the multiplier it gets', () => {
    const r = run()
    expect(r.xp).toBeGreaterThan(0)
    expect(r.xp).toBe(huntXp({ kills: r.kills, elites: r.elites, zone: FOREST.z1, difficulty: 'normal' }))
    const boosted = run({ xpMultiplier: 2.5 })
    expect(boosted.kills).toBe(r.kills)
    expect(boosted.gold).toBe(r.gold)
    expect(boosted.xp).toBe(huntXp({ kills: r.kills, elites: r.elites, zone: FOREST.z1, difficulty: 'normal', multiplier: 2.5 }))
    expect(run({ startedAt: 5 * HOUR, now: HOUR }).xp).toBe(0)
  })
  it('uses no potions when the stock is 0', () => {
    expect(run().potionsUsed).toEqual({ hp: 0, mp: 0 })
  })
  it('never uses more potions than the stock', () => {
    const r = run({ hero: hero(8, { hp: 5, mp: 5 }), zone: FOREST.z2, now: 8 * HOUR })
    expect(r.potionsUsed.hp).toBeLessThanOrEqual(5)
    expect(r.potionsUsed.mp).toBeLessThanOrEqual(5)
  })
})
