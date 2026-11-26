// Fase 2c: skill passives (talent effects) and support gems (hero.supports) in the pack fight sim.
import { describe, expect, it } from 'vitest'
import { simulateFight } from '../../shared/game/combat.js'
import { SKILLS } from '../../shared/game/skills.js'
import { baseStats } from '../../shared/game/stats.js'

const S = Object.fromEntries(SKILLS.map((s) => [s.id, s]))
const NO_POTIONS = { potions: { hp: 0, mp: 0 }, thresholds: { hp: 0, mp: 0 } }
const hero = (stats, skills = [], supports = []) => ({ stats, skills: skills.map((id) => ({ id, level: 1 })), supports, ...NO_POTIONS })
const flat = (over = {}) => ({ ...baseStats(10), critChance: 0, dodge: 0, hp: 1e6, mana: 1e4, effects: [], ...over })
const dummy = (x, y, over = {}) => ({
  id: 'dummy', sprite: 'slime', element: 'physical', mods: [], spawn: { x, y },
  base: { hp: 1e7, attack: 0, armor: 0, attackSpeed: 1, speed: 0, res: { fire: 0, ice: 0, lightning: 0, poison: 0 }, ...over },
})
const run = (skills, { effects = [], supports = [], foes, over = {}, seed = 'm' }) =>
  simulateFight({ hero: hero(flat({ attack: 100, effects, ...over }), skills, supports), enemies: foes, seed })
const of = (r, pred) => r.log.filter(pred)
const targets = (ev) => ev.hits.map((h) => h.target)
const at = (r, t, pred) => of(r, (e) => e.t === t && pred(e))
const PACK = [dummy(1, 0), dummy(0, 1.2), dummy(-1, -0.5)]

describe('passives', () => {
  it('golpeTwice: each golpe cast is followed at once by a second cleave at 60%', () => {
    const r = run(['golpe'], { effects: ['golpeTwice'], foes: PACK })
    const first = of(r, (e) => e.skill === 'golpe')[0]
    const both = at(r, first.t, (e) => e.skill === 'golpe')
    expect(both).toHaveLength(2)
    expect(both[1].echo).toBe(true)
    expect(targets(both[1]).sort()).toEqual([0, 1, 2])
    for (const hit of both[1].hits) expect(hit.amount).toBe(Math.round(100 * S.golpe.power * 0.6))
    const plain = run(['golpe'], { foes: PACK })
    expect(of(plain, (e) => e.skill === 'golpe').length * 2).toBe(of(r, (e) => e.skill === 'golpe').length)
  })

  it('breadthFirst: raio reaches 5 foes, 7 with chainBolt as well', () => {
    const line = [dummy(2, 0), dummy(3, 1), dummy(4, 0), dummy(5, 1), dummy(6, 0), dummy(7, 1), dummy(8, 0), dummy(9, 1)]
    expect(targets(of(run(['raio'], { effects: ['breadthFirst'], foes: line }), (e) => e.skill === 'raio')[0])).toHaveLength(5)
    expect(targets(of(run(['raio'], { effects: ['breadthFirst', 'chainBolt'], foes: line }), (e) => e.skill === 'raio')[0])).toHaveLength(7)
  })

  it('divideConquer: chama throws a second patch on the next group, every foe burns once', () => {
    const foes = [dummy(4, 0), dummy(4.5, 0.5), dummy(0, 4), dummy(0.4, 4.3), dummy(-4, 0)]
    const r = run(['chama'], { effects: ['divideConquer'], foes })
    const first = of(r, (e) => e.type === 'cast' && e.skill === 'chama')[0]
    const casts = at(r, first.t, (e) => e.type === 'cast' && e.skill === 'chama')
    expect(casts).toHaveLength(2)
    expect(casts[0].extra).toBeUndefined()
    expect(casts[1].extra).toBe(1)
    expect(casts[1].at).not.toEqual(casts[0].at)
    const hit = [...targets(casts[0]), ...targets(casts[1])]
    expect(new Set(hit).size).toBe(hit.length)
    expect(hit.sort()).toEqual([0, 1, 2, 3])
    const tick = of(r, (e) => e.type === 'dot' && e.skill === 'chama')[0]
    expect(targets(tick).sort()).toEqual([0, 1, 2, 3])
  })

  it('divideConquer with one group: no second patch (nobody new to burn)', () => {
    const r = run(['chama'], { effects: ['divideConquer'], foes: [dummy(4, 0), dummy(4.5, 0.5)] })
    const first = of(r, (e) => e.type === 'cast' && e.skill === 'chama')[0]
    expect(at(r, first.t, (e) => e.type === 'cast' && e.skill === 'chama')).toHaveLength(1)
  })

  it('fork: veneno spits a second line at foes the first missed', () => {
    const foes = [dummy(2, 0), dummy(4, 0.2), dummy(0, 3), dummy(0.2, 5)]
    const r = run(['veneno'], { effects: ['fork'], foes })
    const first = of(r, (e) => e.type === 'cast' && e.skill === 'veneno')[0]
    const casts = at(r, first.t, (e) => e.type === 'cast' && e.skill === 'veneno')
    expect(casts).toHaveLength(2)
    expect(targets(casts[0]).sort()).toEqual([0, 1])
    expect(targets(casts[1]).sort()).toEqual([2, 3])
    expect(casts[1].width).toBeCloseTo(1.2)
  })

  it('endlessWinter: nevasca reaches 4.2 tiles and says so in the log', () => {
    const foes = [dummy(1, 0), dummy(4, 0), dummy(5, 0)]
    const plain = of(run(['nevasca'], { foes }), (e) => e.skill === 'nevasca')[0]
    const wide = of(run(['nevasca'], { effects: ['endlessWinter'], foes }), (e) => e.skill === 'nevasca')[0]
    expect(targets(plain)).toEqual([0])
    expect(targets(wide).sort()).toEqual([0, 1])
    expect(wide.radius).toBeCloseTo(4.2)
  })

  it('globalScope: golpe reaches 2.16 tiles and veneno draws a wider line', () => {
    const foes = [dummy(1, 0), dummy(2.1, 0)]
    const r = run(['golpe'], { effects: ['globalScope'], foes })
    expect(targets(of(r, (e) => e.skill === 'golpe')[0]).sort()).toEqual([0, 1])
    const v = run(['veneno'], { effects: ['globalScope'], foes: [dummy(3, 0), dummy(5, 0.7)] })
    const cast = of(v, (e) => e.type === 'cast' && e.skill === 'veneno')[0]
    expect(targets(cast).sort()).toEqual([0, 1])
    expect(cast.width).toBeCloseTo(1.44)
  })

  it('quickCache: golpe comes back every 3.48 s instead of 4', () => {
    const r = run(['golpe'], { effects: ['quickCache'], foes: PACK })
    const ts = of(r, (e) => e.skill === 'golpe').map((e) => e.t)
    expect(ts[1] - ts[0]).toBe(3500)
    const plain = of(run(['golpe'], { foes: PACK }), (e) => e.skill === 'golpe').map((e) => e.t)
    expect(plain[1] - plain[0]).toBe(4000)
  })

  it('memoryLeak: chama burns for 7 ticks instead of 6', () => {
    const r = run(['chama'], { effects: ['memoryLeak'], foes: [dummy(4, 0)] })
    const cast = of(r, (e) => e.type === 'cast' && e.skill === 'chama')[0]
    expect(cast.dot.ms).toBe(7800)
    const ticks = of(r, (e) => e.type === 'dot' && e.t > cast.t && e.t <= cast.t + 7800)
    expect(ticks).toHaveLength(7)
  })

  it('critBlast: a crit explodes on the foes around its target for 30% of it; no crit, no blast', () => {
    const foes = [dummy(1.2, 0), dummy(2.2, 0), dummy(-1.2, 0)]
    const r = run(['golpe'], { effects: ['critBlast'], foes, over: { critChance: 100, critDamage: 200 } })
    const cast = of(r, (e) => e.skill === 'golpe')[0]
    const blasts = at(r, cast.t, (e) => e.skill === 'critBlast')
    // golpe hits foes 0 and 2 (foe 1 stands beyond its radius). Foe 0 has foe 1 near it; foe 2 has nobody.
    expect(targets(cast).sort()).toEqual([0, 2])
    expect(blasts).toHaveLength(1)
    expect(blasts[0]).toMatchObject({ who: 'hero', type: 'skill', shape: 'area', radius: 1.5, at: { x: 1.2, y: 0 } })
    expect(targets(blasts[0])).toEqual([1])
    expect(blasts[0].hits[0].amount).toBe(Math.round(cast.hits.find((h) => h.target === 0).amount * 0.3))
    expect(of(run(['golpe'], { effects: ['critBlast'], foes }), (e) => e.skill === 'critBlast')).toHaveLength(0)
  })

  it('tryCatch: hits barreira absorbs come back at 40% to the attacker', () => {
    const biter = dummy(1.3, 0, { attack: 50, hp: 1e6 })
    const r = run(['barreira'], { effects: ['tryCatch'], foes: [biter], over: { armor: 0 } })
    const absorbed = of(r, (e) => e.who === 'enemy' && e.type === 'hit' && e.absorbed > 0)
    expect(absorbed.length).toBeGreaterThan(0)
    const back = of(r, (e) => e.skill === 'tryCatch')
    expect(back.length).toBe(absorbed.length)
    expect(back[0]).toMatchObject({ who: 'hero', type: 'skill', shape: 'single', target: 0 })
    expect(back[0].hits[0].amount).toBe(Math.round(absorbed[0].absorbed * 0.4))
    expect(of(run(['barreira'], { foes: [biter], over: { armor: 0 } }), (e) => e.skill === 'tryCatch')).toHaveLength(0)
  })

  it('garbageCollector: after cura, 4% of max hp comes back each second for 5 s', () => {
    const biter = dummy(1.3, 0, { attack: 400 })
    const r = run(['cura'], { effects: ['garbageCollector'], foes: [biter], over: { hp: 10000, armor: 0 } })
    const cura = of(r, (e) => e.type === 'heal' && e.skill === 'cura' && !e.hot)[0]
    const hots = of(r, (e) => e.type === 'heal' && e.hot && e.t > cura.t && e.t <= cura.t + 5000)
    expect(hots.map((e) => e.t - cura.t)).toEqual([1000, 2000, 3000, 4000, 5000])
    for (const e of hots) expect(e.amount).toBeLessThanOrEqual(400)
    expect(hots[0]).toMatchObject({ who: 'hero', skill: 'cura', shape: 'self', amount: 400 })
  })
})

describe('supports', () => {
  it('projeteis: chama throws 2 patches for 15% less; with divideConquer 3', () => {
    const foes = [dummy(4, 0), dummy(0, 4), dummy(-4, 0), dummy(0, -4)]
    const r = run(['chama'], { supports: ['projeteis'], foes })
    const first = of(r, (e) => e.type === 'cast' && e.skill === 'chama')[0]
    expect(at(r, first.t, (e) => e.type === 'cast' && e.skill === 'chama')).toHaveLength(2)
    const tick = of(r, (e) => e.type === 'dot' && e.skill === 'chama')[0]
    for (const hit of tick.hits) expect(hit.amount).toBe(Math.round(100 * S.chama.power * 0.85))
    const three = run(['chama'], { effects: ['divideConquer'], supports: ['projeteis'], foes })
    expect(at(three, first.t, (e) => e.type === 'cast' && e.skill === 'chama')).toHaveLength(3)
  })

  it('encadear: raio reaches 5 foes', () => {
    const line = [dummy(2, 0), dummy(3, 1), dummy(4, 0), dummy(5, 1), dummy(6, 0), dummy(7, 1)]
    expect(targets(of(run(['raio'], { supports: ['encadear'], foes: line }), (e) => e.skill === 'raio')[0])).toHaveLength(5)
  })

  it('concentrado: golpe hits 35% harder on a smaller circle', () => {
    const r = run(['golpe'], { supports: ['concentrado'], foes: [dummy(1, 0), dummy(1.5, 0)] })
    const cast = of(r, (e) => e.skill === 'golpe')[0]
    expect(targets(cast)).toEqual([0])
    expect(cast.hits[0].amount).toBe(Math.round(100 * S.golpe.power * 1.35))
    expect(cast.radius).toBeCloseTo(1.26)
  })

  it('areaAmpla: golpe reaches 2.34 tiles', () => {
    const r = run(['golpe'], { supports: ['areaAmpla'], foes: [dummy(1, 0), dummy(2.3, 0)] })
    expect(targets(of(r, (e) => e.skill === 'golpe')[0]).sort()).toEqual([0, 1])
  })

  it('rapido: golpe every 3.2 s; raio costs 24 mana', () => {
    const r = run(['golpe'], { supports: ['rapido'], foes: PACK })
    const ts = of(r, (e) => e.skill === 'golpe').map((e) => e.t)
    expect(ts[1] - ts[0]).toBe(3200)
    const tight = simulateFight({
      hero: hero(flat({ attack: 100, mana: 47 }), ['raio'], ['rapido']), enemies: [dummy(2, 0)], seed: 'mana',
    })
    // 47 mana with 2%/s regen: one cast at 24, the second waits for the mana.
    expect(of(tight, (e) => e.skill === 'raio').length).toBeGreaterThanOrEqual(1)
  })

  it('fogo: each golpe hit carries 20% more as fire, which fire res cuts and imune-fogo stops', () => {
    const plain = Math.round(100 * S.golpe.power)
    const r = run(['golpe'], { supports: ['fogo'], foes: [dummy(1, 0)] })
    const cast = of(r, (e) => e.skill === 'golpe')[0]
    expect(cast.hits[0].amount).toBe(plain + Math.round(100 * S.golpe.power * 0.2))
    expect(cast.added).toBe('fire')
    const resist = run(['golpe'], { supports: ['fogo'], foes: [dummy(1, 0, { res: { fire: 50 } })] })
    expect(of(resist, (e) => e.skill === 'golpe')[0].hits[0].amount).toBe(plain + Math.round(100 * S.golpe.power * 0.2 * 0.5))
    const immune = run(['golpe'], { supports: ['fogo'], foes: [{ ...dummy(1, 0), mods: ['imune-fogo'] }] })
    expect(of(immune, (e) => e.skill === 'golpe')[0].hits[0].amount).toBe(plain)
  })

  it('vampiro: a golpe cast heals 5% of the damage it dealt, once per cast', () => {
    const biter = dummy(1.2, 0, { attack: 300 })
    const r = run(['golpe'], { supports: ['vampiro'], foes: [biter, dummy(-1, 0)], over: { hp: 5000, armor: 0 } })
    const casts = of(r, (e) => e.skill === 'golpe')
    const heals = of(r, (e) => e.type === 'heal' && e.skill === 'vampiro')
    expect(heals.length).toBeGreaterThan(0)
    expect(heals.length).toBeLessThanOrEqual(casts.length)
    const healed = heals[0]
    const cast = casts.find((c) => c.t === healed.t)
    expect(healed.amount).toBeLessThanOrEqual(Math.round(cast.amount * 0.05))
  })

  it('frio: golpe slows what it hits by 20% for 2 s', () => {
    const r = run(['golpe'], { supports: ['frio'], foes: PACK })
    expect(of(r, (e) => e.skill === 'golpe')[0].slow).toEqual({ pct: 0.2, ms: 2000 })
  })

  it('persistencia: furia lasts 8.4 s', () => {
    const r = run(['furia'], { supports: ['persistencia'], foes: PACK })
    expect(of(r, (e) => e.type === 'buff')[0].ms).toBe(8400)
  })

  it('a hero with no supports and no passives fights exactly as before (same log for the same seed)', () => {
    const a = simulateFight({ hero: { ...hero(flat({ attack: 100 }), ['golpe', 'raio']) }, enemies: PACK, seed: 'same' })
    const { supports: _s, ...bare } = hero(flat({ attack: 100 }), ['golpe', 'raio'])
    const b = simulateFight({ hero: bare, enemies: PACK, seed: 'same' })
    expect(a).toEqual(b)
  })

  it('is deterministic with every mod on', () => {
    const all = () => run(['golpe', 'raio', 'chama', 'veneno'], {
      effects: ['golpeTwice', 'breadthFirst', 'divideConquer', 'fork', 'critBlast', 'quickCache'],
      supports: ['projeteis', 'fogo', 'vampiro', 'frio'],
      foes: [dummy(2, 0), dummy(3, 1), dummy(0, 3), dummy(-2, 1)],
      over: { critChance: 40 },
      seed: 'det',
    })
    expect(all()).toEqual(all())
  })
})
