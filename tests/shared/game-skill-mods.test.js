import { describe, expect, it } from 'vitest'
import { PASSIVES, SUPPORTS, modsFor, tuneSkill } from '../../shared/game/skill-mods.js'
import { SKILLS } from '../../shared/game/skills.js'

const S = Object.fromEntries(SKILLS.map((s) => [s.id, s]))
const tune = (id, effects = [], supports = []) => tuneSkill(S[id], { effects, supports })

describe('the tables', () => {
  it('has 11 skill-changing passives and 9 support gems', () => {
    expect(Object.keys(PASSIVES)).toHaveLength(11)
    expect(Object.keys(SUPPORTS)).toHaveLength(9)
  })

  it('names a known skill wherever a passive is tied to one', () => {
    for (const [id, p] of Object.entries(PASSIVES)) if (p.skill) expect(S[p.skill], id).toBeTruthy()
  })
})

describe('tuneSkill: no mods', () => {
  it('leaves every skill as it is, with power x1, no extras and no mods', () => {
    for (const def of SKILLS) {
      const t = tuneSkill(def)
      expect(t).toMatchObject({ ...def, more: 1, extra: 0, mods: [] })
    }
  })
})

describe('tuneSkill: passives', () => {
  it('golpeTwice: golpe strikes again at 60%; other skills untouched', () => {
    expect(tune('golpe', ['golpeTwice']).echo).toBe(0.6)
    expect(tune('nevasca', ['golpeTwice']).echo ?? 0).toBe(0)
  })

  it('breadthFirst: raio jumps to 2 more foes', () => {
    expect(tune('raio', ['breadthFirst']).targets).toBe(5)
  })

  it('divideConquer: chama throws a second patch; fork: veneno spits a second line', () => {
    expect(tune('chama', ['divideConquer']).extra).toBe(1)
    expect(tune('veneno', ['fork']).extra).toBe(1)
    expect(tune('golpe', ['fork']).extra).toBe(0)
  })

  it('endlessWinter: nevasca radius +40%', () => {
    expect(tune('nevasca', ['endlessWinter']).radius).toBeCloseTo(4.2)
    expect(tune('golpe', ['endlessWinter']).radius).toBe(1.8)
  })

  it('globalScope: +20% area for around, area and pierce skills', () => {
    expect(tune('golpe', ['globalScope']).radius).toBeCloseTo(2.16)
    expect(tune('chama', ['globalScope']).radius).toBeCloseTo(1.92)
    expect(tune('veneno', ['globalScope']).width).toBeCloseTo(1.44)
    expect(tune('nevasca', ['globalScope', 'endlessWinter']).radius).toBeCloseTo(4.8)
    expect(tune('raio', ['globalScope']).mods).toEqual([])
  })

  it('quickCache: every cooldown recovers 15% faster', () => {
    expect(tune('golpe', ['quickCache']).cooldownMs).toBe(Math.round(4000 / 1.15))
    expect(tune('cura', ['quickCache']).cooldownMs).toBe(Math.round(15000 / 1.15))
  })

  it('memoryLeak: dots last 30% longer', () => {
    expect(tune('chama', ['memoryLeak']).durationMs).toBe(7800)
    expect(tune('veneno', ['memoryLeak']).durationMs).toBe(13000)
    expect(tune('furia', ['memoryLeak']).durationMs).toBe(6000)
  })

  it('critBlast only on skills that crit (hits)', () => {
    expect(tune('golpe', ['critBlast']).blast).toEqual({ pct: 0.3, radius: 1.5 })
    expect(tune('chama', ['critBlast']).blast).toBeUndefined()
  })

  it('tryCatch: barreira reflects 40% of what it absorbs; garbageCollector: cura heals 4%/s for 5 s', () => {
    expect(tune('barreira', ['tryCatch']).reflect).toBe(0.4)
    expect(tune('cura', ['garbageCollector']).hot).toEqual({ pct: 0.04, ms: 5000 })
  })

  it('lists the mods that change the skill, passives then supports', () => {
    expect(tune('raio', ['breadthFirst', 'quickCache', 'fork', 'bruteForce'], ['encadear', 'projeteis']).mods).toEqual([
      { kind: 'passive', id: 'breadthFirst' },
      { kind: 'passive', id: 'quickCache' },
      { kind: 'support', id: 'encadear' },
    ])
  })
})

describe('tuneSkill: supports', () => {
  it('projeteis: +1 area or line, 15% less damage', () => {
    expect(tune('chama', [], ['projeteis'])).toMatchObject({ extra: 1, more: 0.85 })
    expect(tune('veneno', ['fork'], ['projeteis'])).toMatchObject({ extra: 2 })
    expect(tune('golpe', [], ['projeteis']).mods).toEqual([])
  })

  it('encadear: chain skills jump to 2 more foes, stacking with breadthFirst', () => {
    expect(tune('raio', ['breadthFirst'], ['encadear']).targets).toBe(7)
  })

  it('areaAmpla +30% area; concentrado -30% area and +35% damage', () => {
    expect(tune('golpe', [], ['areaAmpla']).radius).toBeCloseTo(2.34)
    const c = tune('nevasca', [], ['concentrado'])
    expect(c.radius).toBeCloseTo(2.1)
    expect(c.more).toBeCloseTo(1.35)
    expect(tune('golpe', [], ['areaAmpla', 'concentrado']).radius).toBeCloseTo(1.8)
  })

  it('rapido: cooldowns recover 25% faster for 20% more mana, stacking with quickCache', () => {
    const r = tune('raio', ['quickCache'], ['rapido'])
    expect(r.cooldownMs).toBe(Math.round(6000 / 1.4))
    expect(r.mana).toBe(24)
  })

  it('fogo adds 20% of a hit as fire; vampiro heals 5% of the damage hits deal', () => {
    expect(tune('golpe', [], ['fogo']).addedFire).toBe(0.2)
    expect(tune('chama', [], ['fogo']).addedFire ?? 0).toBe(0)
    expect(tune('raio', [], ['vampiro']).leech).toBe(0.05)
  })

  it('frio slows what hits and dots land on by 20% for 2 s, never weakening a stronger slow', () => {
    expect(tune('golpe', [], ['frio'])).toMatchObject({ slow: 0.2, slowMs: 2000 })
    expect(tune('veneno', [], ['frio'])).toMatchObject({ slow: 0.2, slowMs: 2000 })
    expect(tune('nevasca', [], ['frio'])).toMatchObject({ slow: 0.3, slowMs: 4000 })
    expect(tune('cura', [], ['frio']).mods).toEqual([])
  })

  it('persistencia: dots and buffs last 40% longer, with memoryLeak 70%', () => {
    expect(tune('furia', [], ['persistencia']).durationMs).toBe(8400)
    expect(tune('chama', ['memoryLeak'], ['persistencia']).durationMs).toBe(10200)
  })

  it('a support socketed twice counts once; unknown ids are ignored', () => {
    expect(tune('raio', [], ['encadear', 'encadear', 'nope']).targets).toBe(5)
  })
})

describe('modsFor', () => {
  it('answers what changes each skill id', () => {
    const mods = modsFor({ effects: ['golpeTwice'], supports: ['fogo'] })
    expect(mods.golpe).toEqual([{ kind: 'passive', id: 'golpeTwice' }, { kind: 'support', id: 'fogo' }])
    expect(mods.cura).toEqual([])
  })
})
