import { describe, expect, it } from 'vitest'
import { POTION_COOLDOWN_MS, TICK_MS, TRASH_TIMEOUT_MS, simulateFight } from '../../shared/game/combat.js'
import { ENEMIES, enemyFor, packFor } from '../../shared/game/enemies.js'
import { createRng } from '../../shared/game/rng.js'
import { baseStats, heroStats, power } from '../../shared/game/stats.js'
import { ZONES } from '../../shared/game/zones.js'

const FOREST = ZONES['floresta-js']
const NO_POTIONS = { potions: { hp: 0, mp: 0 }, thresholds: { hp: 0, mp: 0 } }

const hero = (stats, extra = {}) => ({ stats, skills: [{ id: 'golpe', level: 1 }], ...NO_POTIONS, ...extra })
const atLevel = (level, extra) => hero(heroStats({ level }), extra)
// A plain stat block with no crits and no dodge, so damage numbers are exact.
const flat = (over = {}) => ({ ...baseStats(10), critChance: 0, dodge: 0, effects: [], ...over })
// A dummy that never hits back.
const dummy = (over = {}) => ({
  id: 'dummy', element: 'physical', mods: [],
  base: { hp: 1e7, attack: 0, armor: 0, attackSpeed: 1, res: { fire: 0, ice: 0, lightning: 0, poison: 0 }, ...over },
})
const bossOf = (zone) => enemyFor(zone, 'normal', createRng('boss'), { boss: true })
const events = (result, pred) => result.log.filter(pred)
// A hero from baseStats at a level plus one flat item (fake base, so the test controls the numbers).
const geared = (level, stats) => heroStats({
  level,
  items: [{ base: 'test-item', upgrade: 0, affixes: [], sockets: [] }],
  bases: [{ id: 'test-item', slot: 'ring', stats }],
})

describe('combat constants', () => {
  it('exports the brief values', () => {
    expect(TICK_MS).toBe(100)
    expect(TRASH_TIMEOUT_MS).toBe(60000)
    expect(POTION_COOLDOWN_MS).toBe(10000)
  })
})

describe('simulateFight basics', () => {
  const zone = FOREST.z2
  it('gives a deep-equal result for the same inputs and seed', () => {
    const enemy = enemyFor(zone, 'normal', createRng('e'), { elite: true })
    const input = { hero: atLevel(12, { skills: [{ id: 'raio', level: 2 }, { id: 'golpe', level: 1 }] }), enemy, seed: 's1' }
    expect(simulateFight(input)).toEqual(simulateFight(input))
  })
  it('lets a level 20 hero beat a z1 common', () => {
    const r = simulateFight({ hero: atLevel(20), enemy: enemyFor(FOREST.z1, 'normal', createRng('c')), seed: 'a' })
    expect(r.won).toBe(true)
    expect(r.reason).toBe('killed')
    expect(r.heroHpLeft).toBeGreaterThan(0)
    expect(r.log.at(-1)).toMatchObject({ who: 'enemy', type: 'death' })
  })
  it('lets the hidra beat a level 1 hero with no potions', () => {
    const r = simulateFight({ hero: atLevel(1), enemy: bossOf(FOREST.z3), seed: 'h' })
    expect(r.won).toBe(false)
    expect(['died', 'enrage']).toContain(r.reason)
    expect(r.heroHpLeft).toBe(0)
  })
  it('enrages a boss with huge hp and tiny attack at exactly 90 s', () => {
    const boss = bossOf(FOREST.z3)
    const enemy = { ...boss, base: { ...boss.base, hp: 1e9, attack: 1 } }
    const r = simulateFight({ hero: atLevel(20), enemy, seed: 'e' })
    expect(r).toMatchObject({ won: false, reason: 'enrage', ms: 90000, heroHpLeft: 0 })
    expect(events(r, (e) => e.type === 'enrage')).toHaveLength(1)
  })
  it('times out a trash fight at 60 s as a loss', () => {
    const r = simulateFight({ hero: hero(flat({ attack: 1 })), enemy: dummy(), seed: 't' })
    expect(r).toMatchObject({ won: false, reason: 'timeout', ms: TRASH_TIMEOUT_MS })
  })
  it('logs exactly 2 phases when the boss goes below 33%, with +25% attack each', () => {
    const boss = bossOf(FOREST.z1)
    const enemy = { ...boss, base: { ...boss.base, hp: 2000, attack: 10, attackSpeed: 1 } }
    const r = simulateFight({ hero: hero(flat({ attack: 60, hp: 1e6 })), enemy, seed: 'p' })
    expect(r.won).toBe(true)
    const phases = events(r, (e) => e.type === 'phase')
    expect(phases).toHaveLength(2)
    expect(phases.map((e) => e.skill)).toEqual(boss.phases.map((p) => p.skill))
    // Hero armor 25: the boss's plain hits grow from 10 to 12.5 to 15, times 100 / 125 (its adds are src > 0).
    const hits = events(r, (e) => e.who === 'enemy' && e.type === 'hit' && e.src === 0).map((e) => e.amount)
    expect(new Set(hits)).toEqual(new Set([8, 10, 12]))
    expect(events(r, (e) => e.who === 'enemy' && e.type === 'skill').length).toBeGreaterThan(0)
  })
})

describe('damage rules', () => {
  it('reduces physical damage by 100 / (100 + armor)', () => {
    const r = simulateFight({ hero: hero(flat({ attack: 50 }), { skills: [] }), enemy: dummy({ armor: 25 }), seed: 'x' })
    expect(events(r, (e) => e.type === 'hit')[0].amount).toBe(40)
  })
  it('reduces elemental damage by resistance, capped at 75', () => {
    const fire = (res) => {
      const r = simulateFight({ hero: hero(flat({ attack: 100 }), { skills: [{ id: 'raio', level: 1 }] }), enemy: dummy({ res: { lightning: res } }), seed: 'r' })
      return events(r, (e) => e.skill === 'raio')[0].amount
    }
    expect(fire(0)).toBe(180)
    expect(fire(50)).toBe(90)
    expect(fire(90)).toBe(45)
  })
  it('rolls dodge per incoming hit and crit per hero hit', () => {
    const r = simulateFight({
      hero: hero(flat({ attack: 1, hp: 1e6, dodge: 50, critChance: 50 }), { skills: [] }),
      enemy: dummy({ attack: 10 }),
      seed: 'd',
    })
    const dodges = events(r, (e) => e.type === 'dodge').length
    const enemyHits = events(r, (e) => e.who === 'enemy' && e.type === 'hit').length
    const crits = events(r, (e) => e.type === 'crit').length
    const plain = events(r, (e) => e.who === 'hero' && e.type === 'hit').length
    expect(dodges).toBeGreaterThan(10)
    expect(enemyHits).toBeGreaterThan(10)
    expect(crits).toBeGreaterThan(10)
    expect(plain).toBeGreaterThan(10)
  })
  it('basic attacks every 1000 / attackSpeed ms', () => {
    const r = simulateFight({ hero: hero(flat({ attack: 1, attackSpeed: 2 }), { skills: [] }), enemy: dummy(), seed: 's' })
    expect(events(r, (e) => e.who === 'hero' && e.type === 'hit').length).toBe(119)
  })
  it('regenerates 2% of max mana per second', () => {
    const r = simulateFight({ hero: hero(flat({ mana: 50 }), { skills: [{ id: 'raio', level: 1 }] }), enemy: dummy(), seed: 'm' })
    // Skills fire from the first tick (0.1 s): 50 mana pays for 3 casts (0.1, 6.1, 12.1 s). At 1 mana a
    // second, the next ones come at 30.1 s and 50.1 s.
    expect(events(r, (e) => e.skill === 'raio').map((e) => e.t)).toEqual([100, 6100, 12100, 30100, 50100])
  })
})

describe('potions', () => {
  it('uses at most the stock it has', () => {
    const r = simulateFight({
      hero: atLevel(5, { potions: { hp: 1, mp: 0 }, thresholds: { hp: 0.9, mp: 0 } }),
      enemy: bossOf(FOREST.z3),
      seed: 'p',
    })
    expect(r.potionsUsed.hp).toBeLessThanOrEqual(1)
    expect(events(r, (e) => e.type === 'potion').length).toBeLessThanOrEqual(1)
  })
  it('drinks hp below the threshold, heals 35% of max, and waits for the cooldown', () => {
    const boss = bossOf(FOREST.z3)
    const stats = flat({ hp: 1000, attack: 1 })
    const r = simulateFight({ hero: hero(stats, { potions: { hp: 5, mp: 0 }, thresholds: { hp: 0.5, mp: 0 } }), enemy: { ...boss, base: { ...boss.base, attack: 60 } }, seed: 'q' })
    const drinks = events(r, (e) => e.type === 'potion')
    expect(drinks.length).toBeGreaterThan(1)
    expect(r.potionsUsed.hp).toBe(drinks.length)
    for (const d of drinks) expect(d.amount).toBeLessThanOrEqual(350)
    for (let i = 1; i < drinks.length; i++) expect(drinks[i].t - drinks[i - 1].t).toBeGreaterThanOrEqual(POTION_COOLDOWN_MS)
  })
  it('drinks mp below the threshold and restores 40% of max', () => {
    const r = simulateFight({
      hero: hero(flat({ mana: 100 }), {
        skills: [{ id: 'raio', level: 1 }, { id: 'chama', level: 1 }, { id: 'veneno', level: 1 }],
        potions: { hp: 0, mp: 2 },
        thresholds: { hp: 0, mp: 0.5 },
      }),
      enemy: dummy(),
      seed: 'mp',
    })
    const drinks = events(r, (e) => e.type === 'potion')
    expect(r.potionsUsed.mp).toBe(2)
    expect(drinks.map((d) => d.skill)).toEqual(['mp', 'mp'])
    for (const d of drinks) expect(d.amount).toBe(40)
  })
})

describe('effects', () => {
  const raioHits = (effects, seed = 'c') => {
    const r = simulateFight({ hero: hero(flat({ attack: 100, mana: 1000, effects }), { skills: [{ id: 'raio', level: 1 }] }), enemy: dummy(), seed })
    return events(r, (e) => e.skill === 'raio')
  }
  it('chainBolt makes raio hit for +50%', () => {
    expect(raioHits([])[0].amount).toBe(180)
    expect(raioHits(['chainBolt'])[0].amount).toBe(270)
  })
  it('recursion recasts about 25% of the time and doubles the mana cost', () => {
    const r = simulateFight({ hero: hero(flat({ attack: 10, mana: 1000, effects: ['recursion'] }), { skills: [{ id: 'raio', level: 1 }] }), enemy: dummy(), seed: 'rec' })
    const casts = events(r, (e) => e.skill === 'raio')
    const recasts = casts.filter((e) => e.recast)
    expect(recasts.length).toBeGreaterThan(0)
    expect(recasts.length).toBeLessThan(casts.length / 2)
    // 100 mana at 40 a cast (plus 2 a second): casts at 0.1, 6.1 and 12.1 s, then dry until after 20 s. At 20 a cast, 18.1 s too.
    const low = simulateFight({ hero: hero(flat({ attack: 10, mana: 100, effects: ['recursion'] }), { skills: [{ id: 'raio', level: 1 }] }), enemy: dummy(), seed: 'rec' })
    expect(events(low, (e) => e.skill === 'raio' && !e.recast && e.t < 20000).map((e) => e.t)).toEqual([100, 6100, 12100])
  })
  it('strongTyping keeps the hero from being stunned', () => {
    const boss = bossOf(FOREST.z1)
    const enemy = { ...boss, base: { ...boss.base, hp: 3000, attack: 5 } }
    const run = (effects) => simulateFight({ hero: hero(flat({ attack: 40, hp: 1e6, effects })), enemy, seed: 'st' })
    expect(events(run([]), (e) => e.who === 'enemy' && e.type === 'skill' && e.stun).length).toBeGreaterThan(0)
    expect(events(run(['strongTyping']), (e) => e.stun).length).toBe(0)
  })
  it('rootAccess ignores half the armor', () => {
    const r = simulateFight({ hero: hero(flat({ attack: 50, effects: ['rootAccess'] }), { skills: [] }), enemy: dummy({ armor: 50 }), seed: 'ra' })
    expect(events(r, (e) => e.type === 'hit')[0].amount).toBe(40)
  })
  it('bugSplash sometimes splashes extra poison damage', () => {
    const r = simulateFight({ hero: hero(flat({ attack: 50, effects: ['bugSplash'] }), { skills: [] }), enemy: dummy(), seed: 'bs' })
    const splashes = events(r, (e) => e.skill === 'bugSplash')
    expect(splashes.length).toBeGreaterThan(0)
    for (const s of splashes) expect(s).toMatchObject({ element: 'poison', amount: 25 })
  })
  it('selfCall sometimes attacks twice at once', () => {
    const r = simulateFight({ hero: hero(flat({ attack: 1, effects: ['selfCall'] }), { skills: [] }), enemy: dummy(), seed: 'sc' })
    // 59 swings in 60 s; any extra hit is a self call.
    expect(events(r, (e) => e.who === 'hero' && e.type === 'hit').length).toBeGreaterThan(59)
  })
})

describe('elite mods', () => {
  const elite = (mods, over = {}) => ({ ...dummy(over), elite: true, mods })
  const run = (mods, stats = {}, skills = [], over = {}) =>
    simulateFight({ hero: hero(flat({ attack: 40, mana: 1000, hp: 1e6, ...stats }), { skills }), enemy: elite(mods, over), seed: 'el' })
  it('imune-fogo: no chama event deals damage', () => {
    const zoneElite = enemyFor(FOREST.z2, 'normal', createRng('im'), { elite: true })
    const enemy = { ...zoneElite, mods: ['imune-fogo'] }
    const r = simulateFight({ hero: atLevel(20, { skills: [{ id: 'chama', level: 3 }, { id: 'golpe', level: 1 }] }), enemy, seed: 'f' })
    const chama = events(r, (e) => e.skill === 'chama')
    expect(chama.length).toBeGreaterThan(1)
    for (const e of chama) expect(e.amount ?? 0).toBe(0)
    expect(r.won).toBe(true)
  })
  it('imune-gelo: nevasca does 0', () => {
    const r = run(['imune-gelo'], {}, [{ id: 'nevasca', level: 1 }])
    const hits = events(r, (e) => e.skill === 'nevasca')
    expect(hits.length).toBeGreaterThan(0)
    for (const e of hits) expect(e.amount).toBe(0)
  })
  it('reflete returns 15% of the damage dealt', () => {
    const r = run(['reflete'], { critChance: 0 })
    const back = events(r, (e) => e.skill === 'reflete')
    expect(back.length).toBeGreaterThan(0)
    expect(back[0].amount).toBe(6)
  })
  it('regenera heals 2% of max hp per second', () => {
    const r = run(['regenera'], { attack: 1000 }, [], { hp: 10000 })
    const heals = events(r, (e) => e.who === 'enemy' && e.type === 'heal')
    expect(heals.length).toBeGreaterThan(0)
    expect(heals[0].amount).toBe(200)
  })
  it('acelerado attacks 1.5x as often', () => {
    const count = (mods) => events(run(mods, {}, [], { attack: 1 }), (e) => e.who === 'enemy' && ['hit', 'dodge'].includes(e.type)).length
    expect(count(['acelerado']) / count([])).toBeCloseTo(1.5, 1)
  })
  it('blindado adds 100 armor', () => {
    const r = run(['blindado'], {}, [])
    expect(events(r, (e) => e.type === 'hit' && e.who === 'hero')[0].amount).toBe(20)
  })
})

describe('balance', () => {
  it('a bare hero at zone.minLevel + 2 with only golpe clears every pack, in 5 to 11 s on average', () => {
    for (const zone of Object.values(FOREST)) {
      const stats = heroStats({ level: zone.minLevel + 2 })
      let total = 0
      for (let i = 0; i < 20; i++) {
        const pack = packFor(zone, 'normal', createRng(`${zone.id}-c${i}`), { elite: i % 3 === 2 })
        const r = simulateFight({ hero: hero(stats), enemies: pack, seed: `${zone.id}-f${i}` })
        expect(r.won, `${zone.id} pack ${i}`).toBe(true)
        expect(r.kills).toBe(pack.length)
        total += r.ms
      }
      const mean = total / 20
      expect(mean, zone.id).toBeGreaterThanOrEqual(5000)
      expect(mean, zone.id).toBeLessThanOrEqual(11000)
    }
  })

  // Strong: the boss level plus one item, at or above suggestedPower. Weak: at most 70% of it.
  const GATE = {
    z1: { strong: [5, { attack: 6, hp: 40, armor: 8 }], weak: [3, { attack: 2, hp: 10, armor: 2 }] },
    z2: { strong: [10, { attack: 18, hp: 180, armor: 22 }], weak: [10, {}] },
    z3: { strong: [14, { attack: 35, hp: 350, armor: 45 }], weak: [14, { attack: 9, hp: 90, armor: 9 }] },
  }
  const wins = (stats, zone) => {
    let count = 0
    for (let i = 0; i < 10; i++) {
      const r = simulateFight({
        hero: hero(stats, { potions: { hp: 3, mp: 0 }, thresholds: { hp: 0.4, mp: 0.25 } }),
        enemy: bossOf(zone),
        seed: `${zone.id}-boss-${i}`,
      })
      if (r.won) count++
    }
    return count
  }
  for (const zone of Object.values(FOREST)) {
    it(`gates the ${zone.id} boss by suggestedPower`, () => {
      const strong = geared(...GATE[zone.id].strong)
      const weak = geared(...GATE[zone.id].weak)
      expect(power(strong)).toBeGreaterThanOrEqual(zone.suggestedPower)
      expect(power(weak)).toBeLessThanOrEqual(0.7 * zone.suggestedPower)
      expect(wins(strong, zone)).toBeGreaterThanOrEqual(6)
      expect(wins(weak, zone)).toBeLessThanOrEqual(2)
    })
  }

  it('the bosses are the hardest enemies in their zone', () => {
    for (const zone of Object.values(FOREST)) {
      const boss = ENEMIES.find((e) => e.id === zone.boss)
      for (const id of zone.enemies) expect(boss.base.hp).toBeGreaterThan(ENEMIES.find((e) => e.id === id).base.hp * 5)
    }
  })
})
