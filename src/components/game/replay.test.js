import { describe, expect, it } from 'vitest'
import { simulateFight } from '../../../shared/game/combat.js'
import { enemyFor } from '../../../shared/game/enemies.js'
import { createRng } from '../../../shared/game/rng.js'
import { heroStats } from '../../../shared/game/stats.js'
import { ZONES } from '../../../shared/game/zones.js'
import { replayAt } from './replay.js'

const stats = { hp: 200, mana: 100, effects: [] }
const enemy = { id: 'rei-slime', base: { hp: 1300 } }

describe('replayAt', () => {
  it('starts full and moves the bars with the log', () => {
    const fight = {
      enemy,
      log: [
        { t: 1000, who: 'hero', type: 'hit', amount: 40 },
        { t: 1500, who: 'enemy', type: 'hit', amount: 30 },
        { t: 2000, who: 'hero', type: 'skill', skill: 'golpe', amount: 60 },
        { t: 3000, who: 'enemy', type: 'heal', skill: 'regen', amount: 10 },
        { t: 4000, who: 'hero', type: 'potion', skill: 'hp', amount: 20 },
        { t: 5000, who: 'enemy', type: 'phase', skill: 'golpe-gosma', phase: 2 },
      ],
    }
    expect(replayAt(fight, 0, { stats })).toMatchObject({ hp: 200, mana: 100, boss: { hp: 1300, maxHp: 1300, phase: 1, phases: 3, enrageSec: 90 }, log: [] })
    const mid = replayAt(fight, 2500, { stats })
    expect(mid.hp).toBe(170)
    expect(mid.boss.hp).toBe(1200)
    expect(mid.log).toHaveLength(3)
    expect(mid.cooldowns.golpe).toBe(3.5)
    const late = replayAt(fight, 6000, { stats })
    expect(late.hp).toBe(190)
    expect(late.boss).toMatchObject({ hp: 1210, phase: 2, enrageSec: 84 })
    expect(late.cooldowns.golpe).toBe(0)
  })

  it('takes the mana of a cast and lets it regenerate', () => {
    const fight = { enemy, log: [{ t: 1000, who: 'hero', type: 'skill', skill: 'raio', amount: 10 }] }
    const right = replayAt(fight, 1000, { stats })
    expect(right.mana).toBe(80)
    expect(replayAt(fight, 60000, { stats }).mana).toBe(100)
  })

  it('ends with the hero at the hp the fight left', () => {
    const zone = ZONES['floresta-js'].z1
    const hero = { stats: heroStats({ level: 6 }), skills: [{ id: 'golpe', level: 1 }], potions: { hp: 3, mp: 0 }, thresholds: { hp: 0.4, mp: 0.25 } }
    const foe = enemyFor(zone, 'normal', createRng('replay').fork('enemy'), { boss: true })
    const fight = simulateFight({ hero, enemy: foe, seed: 'replay' })
    const end = replayAt({ ...fight, enemy: { id: foe.id, base: foe.base } }, fight.ms, { stats: hero.stats })
    expect(end.hp).toBe(fight.heroHpLeft)
    if (fight.won) expect(end.boss.hp).toBe(0)
    else expect(end.hp).toBe(0)
  })

  it('reads a pack: each enemy from its spawn, hits by target, spawns kept out of the log lines', () => {
    const fight = {
      log: [
        { t: 0, who: 'enemy', src: 0, type: 'spawn', id: 'slime', sprite: 'slime', hp: 50, elite: true, from: { x: 4, y: 0 }, to: { x: 1.3, y: 0 }, speed: 2.5 },
        { t: 0, who: 'enemy', src: 1, type: 'spawn', id: 'slime', sprite: 'slime', hp: 30, from: { x: 3.3, y: 2.3 }, to: { x: 1.07, y: 0.73 }, speed: 2.5 },
        { t: 1100, who: 'enemy', src: 0, type: 'arrive' },
        { t: 1200, who: 'hero', type: 'skill', skill: 'golpe', shape: 'around', hits: [{ target: 0, amount: 20 }, { target: 1, amount: 30 }], amount: 50 },
        { t: 1200, who: 'enemy', src: 1, type: 'death' },
        { t: 1500, who: 'enemy', src: 0, type: 'hit', amount: 7 },
        { t: 1600, who: 'hero', type: 'cast', skill: 'chama', shape: 'area', hits: [{ target: 0 }], amount: 0 },
        { t: 1700, who: 'hero', type: 'buff', skill: 'furia', shape: 'self', amount: 30, ms: 6000 },
      ],
    }
    const at = replayAt(fight, 1800, { stats: { hp: 200, mana: 200, effects: [] } })
    expect(at.enemies).toEqual([
      { id: 'slime', hp: 30, maxHp: 50, alive: true, elite: true },
      { id: 'slime', hp: 0, maxHp: 30, alive: false },
    ])
    expect(at.hp).toBe(193)
    expect(at.log.map((ev) => ev.type)).toEqual(['skill', 'death', 'hit', 'cast', 'buff'])
    expect(at.cooldowns).toMatchObject({ golpe: 3.4, chama: 7.8, furia: 17.9 })
    expect(at.buffs).toEqual([{ id: 'furia', icon: 'clock', seconds: 6 }])
    // chama 25 + furia 30 mana, and 1.8 s of 2% regen (capped at max).
    expect(at.mana).toBeCloseTo(200 - 55 + 200 * 0.02 * 0.2, 5)
  })

  it('keeps the boss bar on the boss while its adds take hits', () => {
    const fight = {
      log: [
        { t: 0, who: 'enemy', src: 0, type: 'spawn', id: 'rei-slime', sprite: 'rei-slime', hp: 1000, boss: true, from: { x: 3, y: 0 }, to: { x: 1.3, y: 0 }, speed: 1.5 },
        { t: 5000, who: 'enemy', src: 0, type: 'phase', skill: 'golpe-gosma', phase: 2 },
        { t: 5000, who: 'enemy', src: 1, type: 'spawn', id: 'slime', sprite: 'slime', hp: 40, summoner: 0, from: { x: 3.7, y: 2.5 }, to: { x: 1.07, y: 0.73 }, speed: 2.5 },
        { t: 6000, who: 'hero', type: 'skill', skill: 'raio', shape: 'chain', hits: [{ target: 1, amount: 40 }, { target: 0, amount: 100 }], amount: 140 },
        { t: 6000, who: 'enemy', src: 1, type: 'death' },
        { t: 7000, who: 'hero', type: 'dot', skill: 'chama', hits: [{ target: 0, amount: 10 }], amount: 10 },
      ],
    }
    const at = replayAt(fight, 8000, { stats })
    expect(at.boss).toMatchObject({ hp: 890, maxHp: 1000, phase: 2, phases: 3 })
    expect(at.enemies[1]).toMatchObject({ hp: 0, alive: false })
  })

  it('ends a boss pack fight with the boss at 0 or the hero at 0', () => {
    const zone = ZONES['floresta-js'].z2
    const hero = { stats: heroStats({ level: 16 }), skills: [{ id: 'golpe', level: 1 }, { id: 'raio', level: 1 }], potions: { hp: 3, mp: 0 }, thresholds: { hp: 0.4, mp: 0.25 } }
    const foe = enemyFor(zone, 'normal', createRng('adds').fork('enemy'), { boss: true })
    const fight = simulateFight({ hero, enemies: [foe], seed: 'adds' })
    expect(fight.log.filter((ev) => ev.type === 'spawn').length).toBeGreaterThan(1)
    const end = replayAt({ ...fight, enemy: { id: foe.id, base: foe.base } }, fight.ms, { stats: hero.stats })
    expect(end.hp).toBe(fight.heroHpLeft)
    if (fight.won) expect(end.boss.hp).toBe(0)
    else expect(end.hp).toBe(0)
  })
})
