// Fase 2c: support gems as drops (items.js, hunt.js) and the balance of builds that use the tree's
// skill passives and support gems.
import { describe, expect, it } from 'vitest'
import { SUPPORT_CHANCE, settleHunt } from '../../shared/game/hunt.js'
import { SUPPORT_SALVAGE_SCRAP, rollSupport, salvageValue } from '../../shared/game/items.js'
import { createRng } from '../../shared/game/rng.js'
import { SUPPORT_IDS } from '../../shared/game/skill-mods.js'
import { heroStats } from '../../shared/game/stats.js'
import { ZONES } from '../../shared/game/zones.js'

const FOREST = ZONES['floresta-js']
const HOUR = 3600_000

describe('support gems as items', () => {
  it('rolls a support gem with a 12-hex id, the same for the same seed', () => {
    const gem = rollSupport(createRng('s'))
    expect(gem).toEqual({ id: expect.stringMatching(/^[0-9a-f]{12}$/), kind: 'support', support: expect.any(String) })
    expect(SUPPORT_IDS).toContain(gem.support)
    expect(rollSupport(createRng('s'))).toEqual(gem)
  })

  it('rolls every kind over enough tries', () => {
    const rng = createRng('all')
    const seen = new Set(Array.from({ length: 300 }, () => rollSupport(rng).support))
    expect([...seen].sort()).toEqual([...SUPPORT_IDS].sort())
  })

  it('salvages to a flat 15 scrap', () => {
    expect(SUPPORT_SALVAGE_SCRAP).toBe(15)
    expect(salvageValue({ id: 'x', kind: 'support', support: 'fogo' })).toEqual({ scrap: 15 })
  })
})

const fighter = (level, skills, { effects = [], supports = [] } = {}) => {
  const stats = heroStats({ level })
  return {
    stats: { ...stats, effects: [...stats.effects, ...effects] },
    skills: skills.map((id) => ({ id, level: 1 })),
    supports,
    potions: { hp: 0, mp: 0 },
    thresholds: { hp: 0.4, mp: 0.25 },
  }
}

describe('support gems from hunts', () => {
  const hunt = (over = {}) =>
    settleHunt({ hero: fighter(12, ['golpe', 'raio']), zone: FOREST.z2, difficulty: 'normal', startedAt: 0, now: 8 * HOUR, seed: 'sup', bagFree: 1e6, ...over })

  it('drops about one an hour (0.15% a kill): rare, never in place of an item or a gem', () => {
    expect(SUPPORT_CHANCE).toBe(0.0015)
    const r = hunt()
    expect(r.supports.length).toBeGreaterThanOrEqual(2)
    expect(r.supports.length).toBeLessThanOrEqual(20)
    for (const gem of r.supports) expect(gem.kind).toBe('support')
    expect(r.items.every((item) => item.kind === 'gear')).toBe(true)
    expect(r.gems.every((gem) => gem.kind === 'gem')).toBe(true)
  })

  it('is the same for the same seed, and goes to scrap when the bag has no room left', () => {
    const open = hunt()
    expect(hunt()).toEqual(open)
    const full = hunt({ bagFree: 0 })
    expect(full.supports).toEqual([])
    const tight = hunt({ bagFree: open.items.length + open.gems.length })
    expect(tight.supports).toEqual([])
    expect(tight.scrapFromOverflow).toBe(open.supports.length * SUPPORT_SALVAGE_SCRAP)
  })
})

// Builds that use the new tree: stronger is fine, absurd is not. Kills (and so gold) per hour may rise
// at most 60% over the same build without the passives and supports.
describe('balance: skill passives and supports', () => {
  const BUILDS = {
    'z1 L5 golpe, double strike and blasts': {
      zone: 'z1', level: 5, skills: ['golpe'],
      effects: ['golpeTwice', 'critBlast', 'quickCache', 'globalScope'], supports: ['fogo', 'rapido', 'concentrado', 'vampiro'],
    },
    'z2 L12 4 skills, more areas, lines and jumps': {
      zone: 'z2', level: 12, skills: ['golpe', 'raio', 'chama', 'veneno'],
      effects: ['golpeTwice', 'breadthFirst', 'parallelFire', 'fork', 'globalScope'], supports: ['projeteis', 'encadear', 'areaAmpla', 'fogo'],
    },
    'z3 L18 nevasca kit, wider and faster': {
      zone: 'z3', level: 18, skills: ['nevasca', 'raio', 'chama', 'cura'],
      effects: ['endlessWinter', 'breadthFirst', 'parallelFire', 'quickCache', 'memoryLeak'], supports: ['rapido', 'concentrado', 'fogo', 'encadear'],
    },
  }
  const SEEDS = 8
  const perHour = (hero, zone, name) => {
    const sum = { kills: 0, gold: 0, ms: 0 }
    for (let i = 0; i < SEEDS; i++) {
      const r = settleHunt({ hero, zone: FOREST[zone], difficulty: 'normal', startedAt: 0, now: HOUR, seed: `mods:${name}:${i}`, bagFree: 1e6 })
      sum.kills += r.kills
      sum.gold += r.gold
      sum.ms += r.samples.reduce((total, s) => total + s.ms, 0)
    }
    return sum
  }
  for (const [name, build] of Object.entries(BUILDS)) {
    it(name, () => {
      const without = perHour(fighter(build.level, build.skills), build.zone, name)
      const withMods = perHour(fighter(build.level, build.skills, build), build.zone, name)
      for (const key of ['kills', 'gold']) {
        const ratio = withMods[key] / without[key]
        expect(ratio, `${name} ${key}`).toBeGreaterThanOrEqual(1)
        expect(ratio, `${name} ${key}`).toBeLessThanOrEqual(1.6)
      }
      // Each pack falls faster, but never in less than a third of the time (3x; fase 4's bigger packs
      // let area supports hit more foes, so this moved down from 40%).
      expect(withMods.ms / without.ms, `${name} fight time`).toBeGreaterThanOrEqual(0.33)
      expect(withMods.ms / without.ms, `${name} fight time`).toBeLessThan(1)
    })
  }
})
