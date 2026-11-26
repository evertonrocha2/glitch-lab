// Fase 2c: the skill passives and support gems need no new effect kinds. The sim logs one event per
// extra area or line (and longer target lists), so the scene's existing effects simply draw more.
import { describe, expect, it } from 'vitest'
import { simulateFight } from '../../../../shared/game/combat.js'
import { baseStats } from '../../../../shared/game/stats.js'
import { buildPack, FX_KINDS, fxFor } from './pack.js'

const dummy = (x, y) => ({
  id: 'dummy', sprite: 'slime', element: 'physical', mods: [], spawn: { x, y },
  base: { hp: 1e7, attack: 0, armor: 0, attackSpeed: 1, speed: 0, res: {} },
})
const fightWith = (skills, { effects = [], supports = [], foes, over = {} }) =>
  simulateFight({
    hero: {
      stats: { ...baseStats(10), critChance: 0, dodge: 0, hp: 1e6, mana: 1e4, attack: 100, effects, ...over },
      skills: skills.map((id) => ({ id, level: 1 })),
      supports,
      potions: { hp: 0, mp: 0 },
      thresholds: { hp: 0, mp: 0 },
    },
    enemies: foes,
    seed: 'fx',
  })
// The effects of the first cast's moment (every event at that t).
const firstBurst = (fight, kind) => {
  const pack = buildPack(fight)
  const first = pack.fx.find((fx) => fx.kind === kind)
  return pack.fx.filter((fx) => fx.at === first.at && fx.kind === kind)
}
const SPREAD = [dummy(4, 0), dummy(0, 4), dummy(-4, 0), dummy(0, -4)]

describe('the scene draws the extra areas, lines and jumps', () => {
  it('two chama patches with parallelFire, three with projeteis too', () => {
    expect(firstBurst(fightWith(['chama'], { foes: SPREAD }), 'fireball')).toHaveLength(1)
    expect(firstBurst(fightWith(['chama'], { effects: ['parallelFire'], foes: SPREAD }), 'fireball')).toHaveLength(2)
    const three = firstBurst(fightWith(['chama'], { effects: ['parallelFire'], supports: ['projeteis'], foes: SPREAD }), 'fireball')
    expect(three).toHaveLength(3)
    expect(new Set(three.map((fx) => JSON.stringify(fx.spot))).size).toBe(3)
  })

  it('two veneno lines with fork', () => {
    expect(firstBurst(fightWith(['veneno'], { effects: ['fork'], foes: SPREAD }), 'venom')).toHaveLength(2)
  })

  it('a raio bolt that reaches 5 foes with breadthFirst', () => {
    const line = [dummy(2, 0), dummy(3, 1), dummy(4, 0), dummy(5, 1), dummy(6, 0), dummy(7, 1)]
    const [bolt] = firstBurst(fightWith(['raio'], { effects: ['breadthFirst'], foes: line }), 'chain')
    expect(bolt.targets).toHaveLength(5)
  })

  it('a second cleave for golpeTwice and a wider one with globalScope', () => {
    const near = [dummy(1, 0), dummy(-1, 0)]
    expect(firstBurst(fightWith(['golpe'], { effects: ['golpeTwice'], foes: near }), 'cleave')).toHaveLength(2)
    expect(firstBurst(fightWith(['golpe'], { effects: ['globalScope'], foes: near }), 'cleave')[0].radius).toBeCloseTo(2.16)
  })

  it('a crit blast draws as a splash, rethrow as a zap, vampiro and the heal over time as a mend', () => {
    expect(fxFor({ who: 'hero', type: 'skill', skill: 'critBlast', shape: 'area', at: { x: 1, y: 0 }, radius: 1.5, hits: [{ target: 1, amount: 9 }] })[0].kind).toBe('splash')
    expect(fxFor({ who: 'hero', type: 'skill', skill: 'rethrow', shape: 'single', target: 0, hits: [{ target: 0, amount: 9 }] })[0].kind).toBe('zap')
    expect(fxFor({ who: 'hero', type: 'heal', skill: 'vampiro', shape: 'self', amount: 9 })[0].kind).toBe('mend')
    expect(fxFor({ who: 'hero', type: 'heal', skill: 'cura', shape: 'self', amount: 9, hot: true })[0].kind).toBe('mend')
  })

  it('every effect a fully modded fight draws is a known kind', () => {
    const fight = fightWith(['golpe', 'raio', 'chama', 'veneno'], {
      effects: ['golpeTwice', 'breadthFirst', 'parallelFire', 'fork', 'critBlast'],
      supports: ['projeteis', 'fogo', 'vampiro', 'frio'],
      foes: [dummy(1.2, 0), dummy(2.2, 0), ...SPREAD],
      over: { critChance: 50 },
    })
    for (const fx of buildPack(fight).fx) expect(FX_KINDS).toContain(fx.kind)
  })
})
