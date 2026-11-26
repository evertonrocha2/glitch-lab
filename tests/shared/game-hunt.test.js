import { describe, expect, it } from 'vitest'
import { GEM_SALVAGE_SCRAP, MAX_HUNT_MS, SAMPLE_FIGHTS, settleHunt } from '../../shared/game/hunt.js'
import { SUPPORT_SALVAGE_SCRAP, salvageValue } from '../../shared/game/items.js'
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
  it('roughly doubles kills when elapsed doubles (within one pack)', () => {
    const one = run({ now: HOUR }).kills
    const two = run({ now: 2 * HOUR }).kills
    expect(one).toBeGreaterThan(50)
    expect(Math.abs(two - 2 * one)).toBeLessThanOrEqual(FOREST.z1.pack[1])
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
    // Support gems (fase 2c) overflow to scrap as well.
    expect(shut.supports).toEqual([])
    expect(shut.scrapFromOverflow).toBe(itemScrap + open.gems.length * GEM_SALVAGE_SCRAP + open.supports.length * SUPPORT_SALVAGE_SCRAP)
  })
  it('drops fewer kills once the potion stock runs out', () => {
    const base = { hero: hero(10, { hp: 1, mp: 1 }), zone: FOREST.z3, now: 8 * HOUR }
    const rich = run({ ...base, hero: hero(10, { hp: 1e6, mp: 1e6 }) })
    const poor = run(base)
    expect(rich.kills).toBeGreaterThan(poor.kills)
    expect(poor.deaths).toBeGreaterThan(rich.deaths)
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

// Fase 2b: a hunt is a stream of packs. Every equipped skill fires on its own cooldown and the
// cooldowns carry from one pack to the next, so the shown samples use the whole loadout.
describe('settleHunt with packs', () => {
  const kit = (level, ids) => ({ ...hero(level), skills: ids.map((id) => ({ id, level: 1 })) })
  const casts = (samples, id) => samples.flatMap((s) => s.log).filter((e) => e.who === 'hero' && e.skill === id && !e.recast)

  it('a level 7 hero with golpe and raio casts raio in the shown z1 Normal samples', () => {
    const r = run({ hero: kit(7, ['golpe', 'raio']), zone: FOREST.z1, difficulty: 'normal', seed: 'raio-bug' })
    expect(r.samples).toHaveLength(3)
    expect(casts(r.samples, 'raio').length).toBeGreaterThan(0)
    expect(casts(r.samples, 'golpe').length).toBeGreaterThan(0)
  })

  it('shows every equipped damage skill in use', () => {
    const r = run({ hero: kit(12, ['golpe', 'raio', 'chama', 'veneno']), zone: FOREST.z2, seed: 'kit' })
    for (const id of ['golpe', 'raio', 'chama', 'veneno']) expect(casts(r.samples, id).length, id).toBeGreaterThan(0)
  })

  it('each shown sample is a pack: a spawn per foe, the leader riding along as enemy', () => {
    const r = run()
    for (const s of r.samples) {
      const spawns = s.log.filter((e) => e.type === 'spawn')
      expect(spawns.length).toBeGreaterThanOrEqual(FOREST.z1.pack[0])
      expect(s.enemy).toEqual({ id: spawns[0].id, sprite: spawns[0].sprite, elite: Boolean(spawns[0].elite) })
    }
  })
})

// Per hour at the end of fase 3 (packs of 3 to 6, measured with the same 12-seed sim), and the pin for
// fase 4's bigger packs: gold, scrap (bag full) and drops (items + gems) within 15% of it for the same
// hero, xp 20% to 40% over it (fase 4 made progress about 30% faster). The fase 2b pin (before packs)
// had drifted up to 11% off by fase 3, so it moved here.
describe('balance: the hunt economy per hour stays where fase 3 left it, with 30% more xp', () => {
  const BEFORE = {
    'z1 L3 golpe': { zone: 'z1', level: 3, skills: ['golpe'], gold: 3004, scrap: 584, drops: 135, xp: 600 },
    'z1 L5 golpe': { zone: 'z1', level: 5, skills: ['golpe'], gold: 3225, scrap: 604, drops: 148, xp: 645 },
    'z1 L7 4 skills': { zone: 'z1', level: 7, skills: ['golpe', 'raio', 'chama', 'barreira'], gold: 3609, scrap: 691, drops: 165, xp: 722 },
    'z2 L10 golpe': { zone: 'z2', level: 10, skills: ['golpe'], gold: 6156, scrap: 503, drops: 120, xp: 684 },
    'z2 L12 4 skills': { zone: 'z2', level: 12, skills: ['golpe', 'raio', 'chama', 'veneno'], gold: 7083, scrap: 566, drops: 138, xp: 787 },
    'z3 L16 golpe': { zone: 'z3', level: 16, skills: ['golpe'], gold: 11124, scrap: 534, drops: 126, xp: 869 },
    'z3 L18 4 skills': { zone: 'z3', level: 18, skills: ['nevasca', 'raio', 'chama', 'cura'], gold: 12551, scrap: 597, drops: 140, xp: 980 },
  }
  const SEEDS = 12
  for (const [name, row] of Object.entries(BEFORE)) {
    it(name, () => {
      const fighter = { stats: heroStats({ level: row.level }), skills: row.skills.map((id) => ({ id, level: 1 })), potions: { hp: 0, mp: 0 }, thresholds: { hp: 0.4, mp: 0.25 } }
      const sum = { gold: 0, scrap: 0, drops: 0, xp: 0 }
      for (let i = 0; i < SEEDS; i++) {
        const args = { hero: fighter, zone: FOREST[row.zone], difficulty: 'normal', startedAt: 0, now: HOUR, seed: `eco:${name}:${i}` }
        const open = settleHunt({ ...args, bagFree: 1e6 })
        sum.gold += open.gold
        sum.xp += open.xp
        sum.drops += open.items.length + open.gems.length
        sum.scrap += settleHunt({ ...args, bagFree: 0 }).scrapFromOverflow
      }
      for (const key of Object.keys(sum)) {
        const ratio = sum[key] / SEEDS / row[key]
        const [low, high] = key === 'xp' ? [1.2, 1.4] : [0.85, 1.15]
        expect(ratio, `${name} ${key}`).toBeGreaterThan(low)
        expect(ratio, `${name} ${key}`).toBeLessThan(high)
      }
    })
  }
})
