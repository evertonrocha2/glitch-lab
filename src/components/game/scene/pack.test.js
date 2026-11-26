import { describe, expect, it } from 'vitest'
import { activeFloaters, buildPack, FX_KINDS, fxFor, packAt, shakeAt, stackFloaters } from './pack.js'

const fight = (log, extra = {}) => ({ won: true, reason: 'killed', ms: 3000, heroHpLeft: 10, potionsUsed: { hp: 0, mp: 0 }, log, ...extra })
const spawn = (src, extra = {}) => ({ t: 0, who: 'enemy', src, type: 'spawn', id: 'slime', sprite: 'slime', element: 'poison', hp: 100, from: { x: 4, y: 0 }, to: { x: 1.3, y: 0 }, speed: 2.5, ...extra })

const kinds = (ev) => fxFor(ev).map((fx) => fx.kind)

describe('fxFor: every event has its own effect', () => {
  it('gives each of the 8 skills a different effect', () => {
    const events = [
      { who: 'hero', type: 'skill', skill: 'golpe', shape: 'around', radius: 1.8, hits: [] },
      { who: 'hero', type: 'skill', skill: 'raio', shape: 'chain', hits: [{ target: 0 }, { target: 1 }] },
      { who: 'hero', type: 'cast', skill: 'chama', shape: 'area', at: { x: 2, y: 0 }, radius: 1.6, hits: [{ target: 0 }], dot: { ms: 6000 } },
      { who: 'hero', type: 'cast', skill: 'veneno', shape: 'pierce', at: { x: 7, y: 0 }, hits: [{ target: 0 }], dot: { ms: 10000 } },
      { who: 'hero', type: 'skill', skill: 'nevasca', shape: 'around', radius: 3, hits: [], slow: { pct: 0.3, ms: 4000 } },
      { who: 'hero', type: 'shield', skill: 'barreira', amount: 50 },
      { who: 'hero', type: 'heal', skill: 'cura', amount: 50 },
      { who: 'hero', type: 'buff', skill: 'furia', amount: 30, ms: 6000 },
    ]
    const main = events.map((ev) => kinds(ev)[0])
    expect(new Set(main).size).toBe(8)
    expect(main).toEqual(['cleave', 'chain', 'fireball', 'venom', 'frost', 'bubble', 'mend', 'fury'])
  })

  it('slashes on a basic attack, bigger with a gold burst on a crit', () => {
    expect(kinds({ who: 'hero', type: 'hit', target: 0, hits: [{ target: 0, amount: 5 }] })).toEqual(['slash'])
    const crit = fxFor({ who: 'hero', type: 'crit', target: 0, hits: [{ target: 0, amount: 9, crit: true }] })
    expect(crit.map((fx) => fx.kind)).toEqual(['slash', 'critBurst'])
    expect(crit[0].crit).toBe(true)
    expect(kinds({ who: 'hero', type: 'hit', skill: 'selfCall', target: 1, hits: [{ target: 1, amount: 5 }] })).toEqual(['echo'])
  })

  it('has its own effect for dodges, potions, enemy hits, boss moves, spawns and deaths', () => {
    expect(kinds({ who: 'hero', type: 'dodge', src: 0 })).toEqual(['dodge'])
    expect(kinds({ who: 'hero', type: 'potion', skill: 'hp', amount: 9 })).toEqual(['potion'])
    expect(kinds({ who: 'enemy', type: 'hit', src: 0, amount: 4 })).toEqual(['impact'])
    expect(kinds({ who: 'enemy', type: 'hit', src: 0, skill: 'reflete', amount: 4 })).toEqual(['thorns'])
    expect(kinds({ who: 'enemy', type: 'skill', src: 0, skill: 'x', element: 'fire', amount: 4 })).toEqual(['bossBlast'])
    expect(kinds({ who: 'enemy', type: 'phase', src: 0, phase: 2 })).toEqual(['roar'])
    expect(kinds({ who: 'enemy', type: 'enrage', src: 0 })).toEqual(['enrage'])
    expect(kinds(spawn(0))).toEqual(['spawn'])
    expect(kinds(spawn(3, { summoner: 0 }))).toEqual(['summon'])
    expect(kinds({ who: 'enemy', type: 'death', src: 2 })).toEqual(['poof', 'loot'])
    expect(kinds({ who: 'hero', type: 'death' })).toEqual(['heroDeath'])
    expect(kinds({ who: 'enemy', type: 'heal', src: 0, skill: 'regenera', amount: 3 })).toEqual(['regen'])
  })

  it('draws an unknown skill by its shape, and dot ticks and arrivals add nothing', () => {
    expect(kinds({ who: 'hero', type: 'skill', skill: 'bugSplash', shape: 'area', at: { x: 1, y: 0 }, radius: 1.5, hits: [] })).toEqual(['splash'])
    expect(kinds({ who: 'hero', type: 'skill', skill: 'novo', shape: 'chain', hits: [{ target: 0 }] })).toEqual(['chain'])
    expect(kinds({ who: 'hero', type: 'dot', skill: 'chama', hits: [] })).toEqual([])
    expect(kinds({ who: 'enemy', type: 'arrive', src: 0 })).toEqual([])
  })

  it('names only kinds the scene can draw', () => {
    expect(FX_KINDS).toContain('chain')
    expect(FX_KINDS).toContain('levelUp')
  })
})

describe('buildPack and packAt', () => {
  const log = [
    spawn(0),
    spawn(1, { sprite: 'cogumelo', elite: true, from: { x: 3, y: 2 }, to: { x: 1, y: 0.7 } }),
    { t: 1000, who: 'enemy', src: 0, type: 'arrive' },
    { t: 1000, who: 'enemy', src: 1, type: 'arrive' },
    { t: 1200, who: 'hero', type: 'cast', skill: 'chama', shape: 'area', element: 'fire', target: 0, at: { x: 1.3, y: 0 }, radius: 1.6, hits: [{ target: 0 }, { target: 1 }], amount: 0, dot: { ms: 6000 } },
    { t: 1500, who: 'hero', type: 'skill', skill: 'nevasca', shape: 'around', element: 'ice', target: 0, radius: 3, hits: [{ target: 0, amount: 40 }, { target: 1, amount: 30, crit: true }], amount: 70, slow: { pct: 0.3, ms: 4000 } },
    { t: 2000, who: 'hero', type: 'dot', skill: 'chama', element: 'fire', hits: [{ target: 0, amount: 60 }], amount: 60 },
    { t: 2000, who: 'enemy', src: 0, type: 'death' },
  ]
  const pack = buildPack(fight(log), { speed: 1 })

  it('knows every enemy of the pack, its look and its walk', () => {
    expect(pack.foes).toHaveLength(2)
    expect(pack.foes[1]).toMatchObject({ sprite: 'cogumelo', elite: true, maxHp: 100, spawnAt: 0, arriveAt: 1000 })
  })

  it('walks enemies from -> to, then holds them there', () => {
    const s = packAt(pack, 500)
    expect(s.foes[0].x).toBeCloseTo(2.65)
    expect(packAt(pack, 1100).foes[0].x).toBeCloseTo(1.3)
    expect(packAt(pack, 500).foes[0].anim).toBe('walk')
  })

  it('drops each enemy hp with its own hits, burns and slows the ones hit', () => {
    const s = packAt(pack, 1900)
    expect(s.foes[0].hp).toBeCloseTo(0.6)
    expect(s.foes[1].hp).toBeCloseTo(0.7)
    expect(s.foes[0].burning).toBe('fire')
    expect(s.foes[1].slowed).toBe(true)
    expect(packAt(pack, 1000).foes[1].slowed).toBe(false)
  })

  it('plays an enemy death, then stops drawing it', () => {
    expect(packAt(pack, 2300).foes[0].anim).toBe('death')
    expect(packAt(pack, 4000).foes[0].visible).toBe(false)
    expect(packAt(pack, 4000).foes[1].visible).toBe(true)
  })

  it('swings the hero on its casts', () => {
    expect(packAt(pack, 1300).hero.anim).toBe('attack')
  })

  it('divides log times by speed', () => {
    const fast = buildPack(fight(log), { speed: 2 })
    expect(fast.foes[0].arriveAt).toBe(500)
    expect(fast.len).toBeLessThan(pack.len)
  })

  it('reads a log from before packs: one foe from the fallback, hits without lists', () => {
    const old = buildPack(fight([{ t: 100, who: 'hero', type: 'hit', amount: 42 }]), { speed: 1, fallback: { sprite: 'lobo-syntax' } })
    expect(old.foes).toHaveLength(1)
    expect(old.foes[0].sprite).toBe('lobo-syntax')
    expect(old.floaters.some((f) => f.text === '42' && f.target === 0)).toBe(true)
  })
})

describe('floaters', () => {
  const log = [
    spawn(0),
    spawn(1),
    { t: 500, who: 'hero', type: 'skill', skill: 'raio', shape: 'chain', element: 'lightning', target: 0, hits: [{ target: 0, amount: 10 }, { target: 1, amount: 99, crit: true }], amount: 109 },
    { t: 500, who: 'hero', type: 'hit', target: 0, hits: [{ target: 0, amount: 5 }], amount: 5 },
    { t: 600, who: 'hero', type: 'dodge', src: 0 },
  ]
  const pack = buildPack(fight(log), { speed: 1 })

  it('puts each number over its own enemy, crits big and gold', () => {
    const big = pack.floaters.find((f) => f.text === '99')
    expect(big).toMatchObject({ target: 1, big: true, kind: 'crit' })
    expect(pack.floaters.find((f) => f.key === 'game.fx.dodge').target).toBe(-1)
  })

  it('stacks numbers landing together on one enemy instead of drawing them on top of each other', () => {
    const active = activeFloaters(pack, 700, [])
    const placed = stackFloaters(active, { reduced: false })
    const onZero = placed.filter((f) => f.target === 0)
    expect(onZero).toHaveLength(2)
    expect(onZero[0].lane).not.toBe(onZero[1].lane)
    expect(placed.find((f) => f.target === 1).lane).toBe(0)
  })

  it('keeps at most 4 numbers per enemy, the newest', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ t: 100 + i * 10, who: 'hero', type: 'hit', target: 0, hits: [{ target: 0, amount: i + 1 }], amount: i + 1 }))
    const p = buildPack(fight([spawn(0), ...many]), { speed: 1 })
    const placed = stackFloaters(activeFloaters(p, 300, []), { reduced: false })
    expect(placed).toHaveLength(4)
    expect(placed.map((f) => f.floater.text).sort()).toEqual(['4', '5', '6', '7'])
  })

  it('does not drift with reduced motion', () => {
    const placed = stackFloaters(activeFloaters(pack, 900, []), { reduced: true })
    expect(placed.every((f) => f.rise === 0)).toBe(true)
    const moving = stackFloaters(activeFloaters(pack, 900, []), { reduced: false })
    expect(moving.some((f) => f.rise > 0)).toBe(true)
  })
})

describe('shakeAt', () => {
  const log = [
    spawn(0, { hp: 100 }),
    { t: 500, who: 'hero', type: 'crit', target: 0, hits: [{ target: 0, amount: 60, crit: true }], amount: 60 },
    { t: 2000, who: 'hero', type: 'crit', target: 0, hits: [{ target: 0, amount: 5, crit: true }], amount: 5 },
  ]
  const pack = buildPack(fight(log), { speed: 1 })
  it('shakes lightly on a big crit, not on a small one', () => {
    const big = shakeAt(pack, 560, false)
    expect(Math.abs(big.x) + Math.abs(big.y)).toBeGreaterThan(0)
    const small = shakeAt(pack, 2060, false)
    expect(small).toEqual({ x: 0, y: 0 })
  })
  it('never shakes under reduced motion', () => {
    expect(shakeAt(pack, 560, true)).toEqual({ x: 0, y: 0 })
  })
  it('shakes on boss skills', () => {
    const boss = buildPack(fight([spawn(0, { boss: true }), { t: 100, who: 'enemy', src: 0, type: 'skill', skill: 'x', element: 'fire', amount: 9 }]), { speed: 1 })
    const s = shakeAt(boss, 150, false)
    expect(Math.abs(s.x) + Math.abs(s.y)).toBeGreaterThan(0)
  })
})
