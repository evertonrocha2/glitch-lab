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
})
