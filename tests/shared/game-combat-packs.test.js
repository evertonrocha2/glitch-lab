// Fase 2b: pack fights, skill shapes, concurrent autocasting and boss adds (shared/game/combat.js).
import { describe, expect, it } from 'vitest'
import { HERO_REACH, STOP, simulateFight } from '../../shared/game/combat.js'
import { enemyFor, packFor } from '../../shared/game/enemies.js'
import { createRng } from '../../shared/game/rng.js'
import { SKILLS } from '../../shared/game/skills.js'
import { baseStats, heroStats } from '../../shared/game/stats.js'
import { ZONES } from '../../shared/game/zones.js'

const FOREST = ZONES['floresta-js']
const NO_POTIONS = { potions: { hp: 0, mp: 0 }, thresholds: { hp: 0, mp: 0 } }
const hero = (stats, skills = [], extra = {}) => ({ stats, skills: skills.map((id) => ({ id, level: 1 })), ...NO_POTIONS, ...extra })
// No crits, no dodge, a lot of hp and mana: damage numbers are exact and the hero never falls.
const flat = (over = {}) => ({ ...baseStats(10), critChance: 0, dodge: 0, hp: 1e6, mana: 1e4, effects: [], ...over })
// A dummy that stands still at a spot (tiles from the hero) and never hits back.
const dummy = (x, y, over = {}) => ({
  id: 'dummy', sprite: 'slime', element: 'physical', mods: [], spawn: { x, y },
  base: { hp: 1e7, attack: 0, armor: 0, attackSpeed: 1, speed: 0, res: { fire: 0, ice: 0, lightning: 0, poison: 0 }, ...over },
})
const events = (r, pred) => r.log.filter(pred)
const targets = (ev) => ev.hits.map((h) => h.target)

describe('skill shapes', () => {
  it('gives every skill a shape', () => {
    for (const s of SKILLS) expect(['single', 'around', 'area', 'chain', 'pierce', 'self'], s.id).toContain(s.shape)
    expect(new Set(SKILLS.filter((s) => s.shape !== 'self').map((s) => s.shape)).size).toBeGreaterThanOrEqual(4)
  })

  it('golpe cleaves every foe around the hero and nothing beyond its radius', () => {
    const golpe = SKILLS.find((s) => s.id === 'golpe')
    const foes = [dummy(1, 0), dummy(0, 1.2), dummy(-1, -0.5), dummy(golpe.radius + 0.5, 0)]
    const r = simulateFight({ hero: hero(flat({ attack: 100 }), ['golpe']), enemies: foes, seed: 'g' })
    const cast = events(r, (e) => e.skill === 'golpe')[0]
    expect(cast).toMatchObject({ who: 'hero', type: 'skill', shape: 'around' })
    expect(targets(cast).sort()).toEqual([0, 1, 2])
    for (const hit of cast.hits) expect(hit.amount).toBe(Math.round(100 * golpe.power))
    expect(cast.amount).toBe(3 * Math.round(100 * golpe.power))
  })

  it('raio chains to 3 distinct foes, and chainBolt adds 2 jumps and +50%', () => {
    const foes = [dummy(2, 0), dummy(3, 1), dummy(4, 0), dummy(5, 1), dummy(6, 0), dummy(7, 1)]
    const run = (effects) => simulateFight({ hero: hero(flat({ attack: 100, effects }), ['raio']), enemies: foes, seed: 'c' })
    const plain = events(run([]), (e) => e.skill === 'raio')[0]
    expect(plain.shape).toBe('chain')
    expect(new Set(targets(plain)).size).toBe(3)
    expect(targets(plain)).toEqual([0, 1, 2])
    // Each jump deals less than the one before it.
    expect(plain.hits[1].amount).toBeLessThan(plain.hits[0].amount)
    const bolt = events(run(['chainBolt']), (e) => e.skill === 'raio')[0]
    expect(new Set(targets(bolt)).size).toBe(5)
    expect(bolt.hits[0].amount).toBe(Math.round(plain.hits[0].amount * 1.5))
  })

  it('raio on a lone foe hits it once (the chain never lands twice on one foe)', () => {
    const r = simulateFight({ hero: hero(flat({ attack: 100 }), ['raio']), enemies: [dummy(2, 0)], seed: 'c1' })
    expect(targets(events(r, (e) => e.skill === 'raio')[0])).toEqual([0])
  })

  it('chama lands where the most foes stand and burns all of them every second', () => {
    const chama = SKILLS.find((s) => s.id === 'chama')
    const foes = [dummy(2, 3), dummy(4, 0), dummy(4.5, 0.5), dummy(4, -1)]
    const r = simulateFight({ hero: hero(flat({ attack: 100 }), ['chama']), enemies: foes, seed: 'a' })
    const cast = events(r, (e) => e.skill === 'chama' && e.type === 'cast')[0]
    expect(cast).toMatchObject({ shape: 'area', target: 1, at: { x: 4, y: 0 } })
    expect(targets(cast).sort()).toEqual([1, 2, 3])
    const ticks = events(r, (e) => e.type === 'dot' && e.skill === 'chama' && e.t <= cast.t + chama.durationMs)
    expect(ticks.map((e) => e.t - cast.t)).toEqual([1000, 2000, 3000, 4000, 5000, 6000])
    for (const tick of ticks) {
      expect(targets(tick).sort()).toEqual([1, 2, 3])
      for (const hit of tick.hits) expect(hit.amount).toBe(Math.round(100 * chama.power))
    }
  })

  it('veneno pierces every foe on its line and poisons them', () => {
    const foes = [dummy(2, 0), dummy(4, 0.2), dummy(6, -0.2), dummy(3, 3)]
    const r = simulateFight({ hero: hero(flat({ attack: 100 }), ['veneno']), enemies: foes, seed: 'v' })
    const cast = events(r, (e) => e.skill === 'veneno' && e.type === 'cast')[0]
    expect(cast.shape).toBe('pierce')
    expect(targets(cast).sort()).toEqual([0, 1, 2])
    const tick = events(r, (e) => e.type === 'dot' && e.skill === 'veneno')[0]
    expect(targets(tick).sort()).toEqual([0, 1, 2])
  })

  it('nevasca hits and slows everything around the hero', () => {
    const nevasca = SKILLS.find((s) => s.id === 'nevasca')
    const foes = [dummy(1, 0), dummy(-2, 1), dummy(0, -2.5), dummy(nevasca.radius + 1, 0)]
    const r = simulateFight({ hero: hero(flat({ attack: 100 }), ['nevasca']), enemies: foes, seed: 'n' })
    const cast = events(r, (e) => e.skill === 'nevasca')[0]
    expect(cast).toMatchObject({ shape: 'around', slow: { pct: nevasca.slow, ms: nevasca.slowMs } })
    expect(targets(cast).sort()).toEqual([0, 1, 2])
  })

  it('casts a damage skill only once a foe is in its reach', () => {
    const foe = { ...dummy(8, 0), base: { ...dummy(8, 0).base, speed: 2 } }
    const r = simulateFight({ hero: hero(flat({ attack: 1 }), ['golpe']), enemies: [foe], seed: 'w' })
    const first = events(r, (e) => e.skill === 'golpe')[0]
    // 8 tiles at 2 a second: in golpe's 1.8 radius after 3.1 s.
    expect(first.t).toBeGreaterThanOrEqual(3000)
  })
})

describe('concurrent autocasting', () => {
  it('fires two ready skills in the same tick, on top of the basic attack', () => {
    const r = simulateFight({ hero: hero(flat({ attack: 10 }), ['golpe', 'raio']), enemies: [dummy(1, 0)], seed: 'cc' })
    const golpe = events(r, (e) => e.skill === 'golpe')
    const raio = events(r, (e) => e.skill === 'raio')
    expect(golpe[0].t).toBe(raio[0].t)
    // Each skill keeps its own cooldown.
    expect(golpe[1].t - golpe[0].t).toBe(SKILLS.find((s) => s.id === 'golpe').cooldownMs)
    expect(raio[1].t - raio[0].t).toBe(SKILLS.find((s) => s.id === 'raio').cooldownMs)
    const swings = (skills) =>
      events(simulateFight({ hero: hero(flat({ attack: 1 }), skills), enemies: [dummy(1, 0)], seed: 'cc' }), (e) => e.who === 'hero' && e.type === 'hit' && !e.skill).length
    expect(swings(['golpe', 'raio'])).toBe(swings([]))
  })

  it('a skill waits for mana while another one with enough mana fires', () => {
    const r = simulateFight({ hero: hero(flat({ attack: 10, mana: 30 }), ['chama', 'raio', 'golpe']), enemies: [dummy(1, 0)], seed: 'mm' })
    const first = r.log.filter((e) => e.skill && e.t === 100).map((e) => e.skill)
    // chama costs 25 of 30: raio (20) has to wait, golpe (free) fires with it.
    expect(first).toEqual(['chama', 'golpe'])
  })
})

describe('packs', () => {
  it('packs come in the zone size, an elite leading the elite packs', () => {
    for (const zone of Object.values(FOREST)) {
      for (let i = 0; i < 30; i++) {
        const pack = packFor(zone, 'normal', createRng(`p${i}`), { elite: i % 2 === 0 })
        expect(pack.length).toBeGreaterThanOrEqual(zone.pack[0])
        expect(pack.length).toBeLessThanOrEqual(zone.pack[1])
        expect(pack[0].elite).toBe(i % 2 === 0)
        expect(pack.slice(1).every((e) => !e.elite)).toBe(true)
        for (const e of pack) expect(zone.enemies).toContain(e.id)
      }
    }
    expect(FOREST.z1.pack[0]).toBeGreaterThanOrEqual(3)
    expect(FOREST.z3.pack[1]).toBeLessThanOrEqual(6)
  })

  it('spawns every member at t 0 with a walk-in path relative to the hero, and kills them all to win', () => {
    const pack = packFor(FOREST.z1, 'normal', createRng('pk'), { elite: true })
    const r = simulateFight({ hero: hero(heroStats({ level: 12 }), ['golpe']), enemies: pack, seed: 'pk' })
    const spawns = events(r, (e) => e.type === 'spawn')
    expect(spawns).toHaveLength(pack.length)
    spawns.forEach((s, i) => {
      expect(s).toMatchObject({ t: 0, who: 'enemy', src: i, id: pack[i].id, sprite: pack[i].sprite, hp: pack[i].base.hp })
      const far = Math.hypot(s.from.x, s.from.y)
      const near = Math.hypot(s.to.x, s.to.y)
      expect(far).toBeGreaterThan(HERO_REACH)
      expect(near).toBeCloseTo(STOP, 1)
      expect(s.speed).toBeGreaterThan(0)
    })
    expect(spawns[0].elite).toBe(true)
    expect(r.won).toBe(true)
    expect(r.kills).toBe(pack.length)
    expect(r.elites).toBe(1)
    const deaths = events(r, (e) => e.type === 'death' && e.who === 'enemy').map((e) => e.src)
    expect(deaths.sort()).toEqual(pack.map((_, i) => i))
    expect(events(r, (e) => e.type === 'arrive').length).toBeGreaterThan(0)
    // Every hit names targets that exist, and nothing hits a foe after its death.
    const deadAt = Object.fromEntries(events(r, (e) => e.type === 'death' && e.who === 'enemy').map((e) => [e.src, e.t]))
    for (const ev of events(r, (e) => e.who === 'hero' && e.hits)) {
      for (const h of ev.hits) expect(deadAt[h.target] === undefined || ev.t <= deadAt[h.target]).toBe(true)
    }
  })

  it('every enemy-side action names the enemy acting', () => {
    const pack = packFor(FOREST.z2, 'normal', createRng('src'))
    const r = simulateFight({ hero: hero(heroStats({ level: 10 }), ['golpe']), enemies: pack, seed: 'src' })
    for (const ev of events(r, (e) => e.who === 'enemy')) expect(Number.isInteger(ev.src), JSON.stringify(ev)).toBe(true)
    for (const ev of events(r, (e) => e.type === 'dodge')) expect(Number.isInteger(ev.src)).toBe(true)
  })

  it('a hero that falls keeps the kills it made', () => {
    const pack = packFor(FOREST.z3, 'normal', createRng('lose'))
    const r = simulateFight({ hero: hero(heroStats({ level: 9 }), ['golpe']), enemies: pack, seed: 'lose' })
    expect(r.won).toBe(false)
    expect(r.kills).toBe(events(r, (e) => e.type === 'death' && e.who === 'enemy').length)
    expect(r.kills).toBeLessThan(pack.length)
  })

  it('bugSplash splashes the foes around the struck one, selfCall swings at a second foe', () => {
    const foes = [dummy(1, 0), dummy(1.2, 0.8), dummy(0.5, -1.2)]
    const splash = simulateFight({ hero: hero(flat({ attack: 50, effects: ['bugSplash'] })), enemies: foes, seed: 'bs' })
    const splashes = events(splash, (e) => e.skill === 'bugSplash')
    expect(splashes.length).toBeGreaterThan(0)
    for (const s of splashes) {
      expect(s).toMatchObject({ shape: 'area', element: 'poison' })
      expect(s.hits.length).toBeGreaterThan(1)
      for (const h of s.hits) expect(h.amount).toBe(25)
    }
    const call = simulateFight({ hero: hero(flat({ attack: 1, effects: ['selfCall'] })), enemies: foes, seed: 'sc' })
    const calls = events(call, (e) => e.skill === 'selfCall')
    expect(calls.length).toBeGreaterThan(0)
    const before = (c) => events(call, (e) => e.t === c.t && e.type === 'hit' && !e.skill)[0]
    for (const c of calls) expect(c.target).not.toBe(before(c).target)
  })
})

describe('bosses', () => {
  it('calls adds when it enters a phase', () => {
    const boss = enemyFor(FOREST.z1, 'normal', createRng('boss'), { boss: true })
    for (const phase of boss.phases) {
      expect(phase.adds.length).toBeGreaterThan(0)
      for (const add of phase.adds) expect(FOREST.z1.enemies).toContain(add.id)
    }
    const r = simulateFight({ hero: hero(flat({ attack: 60, hp: 1e6 }), ['golpe']), enemies: [boss], seed: 'adds' })
    expect(r.won).toBe(true)
    const phases = events(r, (e) => e.type === 'phase')
    expect(phases).toHaveLength(2)
    const spawns = events(r, (e) => e.type === 'spawn')
    expect(spawns[0]).toMatchObject({ t: 0, src: 0, boss: true })
    const adds = spawns.slice(1)
    expect(adds).toHaveLength(boss.phases.reduce((n, p) => n + p.adds.length, 0))
    for (const add of adds) {
      expect(add.summoner).toBe(0)
      expect(phases.some((p) => p.t === add.t)).toBe(true)
      expect(add.src).toBeGreaterThan(0)
    }
    // The fight ends with the boss, adds or not.
    expect(r.log.at(-1)).toMatchObject({ type: 'death', who: 'enemy', src: 0 })
  })

  it('the adds hit the hero too', () => {
    const boss = enemyFor(FOREST.z2, 'normal', createRng('boss'), { boss: true })
    const r = simulateFight({ hero: hero(flat({ attack: 25, hp: 1e6, armor: 0 })), enemies: [boss], seed: 'addhit' })
    const from = new Set(events(r, (e) => e.who === 'enemy' && e.type === 'hit').map((e) => e.src))
    expect([...from].some((src) => src > 0)).toBe(true)
  })
})

describe('determinism', () => {
  it('same inputs and seed give the same log, another seed another one', () => {
    const pack = packFor(FOREST.z2, 'normal', createRng('d'), { elite: true })
    const input = { hero: hero(heroStats({ level: 12 }), ['golpe', 'raio', 'chama', 'veneno']), enemies: pack, seed: 'det' }
    const a = simulateFight(input)
    expect(simulateFight(input)).toEqual(a)
    expect(simulateFight({ ...input, seed: 'other' }).log).not.toEqual(a.log)
  })

  it('accepts a single enemy as before', () => {
    const foe = enemyFor(FOREST.z1, 'normal', createRng('one'))
    const r = simulateFight({ hero: hero(heroStats({ level: 8 }), ['golpe']), enemy: foe, seed: 'one' })
    expect(r.won).toBe(true)
    expect(r.kills).toBe(1)
  })
})

describe('cooldowns across packs', () => {
  it('starts skills mid cooldown and reports what is left', () => {
    const r = simulateFight({ hero: hero(flat({ attack: 10 }), ['golpe', 'raio']), enemies: [dummy(1, 0)], seed: 'cd', cooldowns: { golpe: 3000 } })
    expect(events(r, (e) => e.skill === 'golpe')[0].t).toBe(3000)
    expect(events(r, (e) => e.skill === 'raio')[0].t).toBe(100)
    const short = simulateFight({ hero: hero(flat({ attack: 1e5 }), ['golpe', 'raio']), enemies: [dummy(1, 0, { hp: 10 })], seed: 'cd2' })
    // golpe fires at 0.1 s and ends the fight before raio's turn: golpe has its whole cooldown left, raio none.
    expect(short).toMatchObject({ won: true, ms: 100, cooldowns: { golpe: 4000, raio: 0 } })
  })
})
