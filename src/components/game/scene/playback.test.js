import { expect, it } from 'vitest'
import { duration, sample, timeline } from './playback.js'

const fight = (log, extra = {}) => ({ won: true, reason: 'killed', ms: 3000, heroHpLeft: 10, potionsUsed: { hp: 0, mp: 0 }, log, ...extra })

const three = fight([
  { t: 1000, who: 'hero', type: 'hit', amount: 12, element: 'physical' },
  { t: 1500, who: 'enemy', type: 'hit', amount: 5 },
  { t: 2000, who: 'hero', type: 'hit', amount: 12, element: 'physical' },
])

it('gives frames in at order for a 3-event fight', () => {
  const frames = timeline(three)
  expect(frames.length).toBeGreaterThanOrEqual(3)
  const ats = frames.map((f) => f.at)
  expect(ats).toEqual([...ats].sort((a, b) => a - b))
  expect(frames[0]).toMatchObject({ actor: 'hero', anim: 'attack' })
  expect(frames.some((f) => f.actor === 'enemy' && f.anim === 'hurt' && f.floater?.kind === 'hit')).toBe(true)
})

it('floats the damage over the victim', () => {
  const frames = timeline(three)
  const onEnemy = frames.find((f) => f.floater && f.actor === 'enemy')
  const onHero = frames.find((f) => f.floater && f.actor === 'hero')
  expect(onEnemy.floater).toMatchObject({ text: '12' })
  expect(onHero.floater).toMatchObject({ text: '5' })
})

it('makes a crit floater gold and big, for basic and skill crits', () => {
  for (const ev of [
    { t: 500, who: 'hero', type: 'crit', amount: 30, element: 'physical' },
    { t: 500, who: 'hero', type: 'skill', skill: 'x', crit: true, amount: 30, element: 'fire' },
  ]) {
    const f = timeline(fight([ev])).find((fr) => fr.floater)
    expect(f.floater.kind).toBe('crit')
    expect(f.floater.big).toBe(true)
    expect(f.floater.color).toMatch(/^#/)
  }
})

it('shows a dodge as the i18n word on the hero', () => {
  const f = timeline(fight([{ t: 500, who: 'hero', type: 'dodge' }])).find((fr) => fr.floater)
  expect(f.actor).toBe('hero')
  expect(f.floater).toMatchObject({ kind: 'dodge', key: 'game.fx.dodge' })
})

it('colors heal green and dot with the element', () => {
  const heal = timeline(fight([{ t: 1, who: 'hero', type: 'heal', skill: 'a', amount: 9 }])).find((fr) => fr.floater)
  expect(heal.floater).toMatchObject({ kind: 'heal', text: '+9' })
  const potion = timeline(fight([{ t: 1, who: 'hero', type: 'potion', skill: 'hp', amount: 9 }])).find((fr) => fr.floater)
  expect(potion.floater.kind).toBe('heal')
  const fire = timeline(fight([{ t: 1, who: 'hero', type: 'dot', skill: 'burn', amount: 4, element: 'fire' }])).find((fr) => fr.floater)
  const poison = timeline(fight([{ t: 1, who: 'hero', type: 'dot', skill: 'x', amount: 4, element: 'poison' }])).find((fr) => fr.floater)
  expect(fire.floater.kind).toBe('dot')
  expect(fire.floater.color).not.toBe(poison.floater.color)
})

it('divides every at by speed', () => {
  const one = timeline(three, { speed: 1 })
  const fast = timeline(three, { speed: 3 })
  expect(fast.map((f) => f.at)).toEqual(one.map((f) => f.at / 3))
  expect(duration(three, { speed: 3 })).toBeCloseTo(duration(three, { speed: 1 }) / 3)
})

it('produces an enrage frame, a phase frame and a death frame', () => {
  const frames = timeline(
    fight(
      [
        { t: 100, who: 'enemy', type: 'phase', phase: 2, skill: 's' },
        { t: 200, who: 'enemy', type: 'enrage' },
        { t: 200, who: 'hero', type: 'death' },
      ],
      { won: false, reason: 'enrage' },
    ),
  )
  expect(frames.some((f) => f.actor === 'enemy' && f.anim === 'enrage')).toBe(true)
  expect(frames.some((f) => f.actor === 'enemy' && f.anim === 'phase')).toBe(true)
  expect(frames.some((f) => f.actor === 'hero' && f.anim === 'death')).toBe(true)
})

it('handles empty logs and timeouts without a terminal event', () => {
  expect(timeline(fight([], { won: false, reason: 'timeout' }))).toEqual([])
  expect(duration(fight([], { won: false, reason: 'timeout', ms: 60000 }))).toBeGreaterThanOrEqual(60000)
})

it('samples the state at a time: anim and progress, active floaters, death held', () => {
  const frames = timeline(three)
  expect(sample(frames, 0).hero.anim).toBe('idle')
  const mid = sample(frames, 1100)
  expect(mid.hero.anim).toBe('attack')
  expect(mid.hero.p).toBeGreaterThan(0)
  const hurt = sample(frames, 1200)
  expect(hurt.floaters.length).toBeGreaterThan(0)
  expect(hurt.floaters[0].age).toBeGreaterThanOrEqual(0)
  const dead = sample(timeline(fight([{ t: 100, who: 'enemy', type: 'death' }])), 5000)
  expect(dead.enemy).toMatchObject({ anim: 'death', p: 1 })
})

// Fase 2b packs: one foe on stage, the first still standing.
const pack = fight([
  { t: 0, who: 'enemy', src: 0, type: 'spawn', id: 'slime', sprite: 'slime', hp: 30, elite: true, from: { x: 4, y: 0 }, to: { x: 1.3, y: 0 }, speed: 2.5 },
  { t: 0, who: 'enemy', src: 1, type: 'spawn', id: 'lobo', sprite: 'lobo-syntax', hp: 30, from: { x: 3.3, y: 2.3 }, to: { x: 1.07, y: 0.73 }, speed: 2.5 },
  { t: 1100, who: 'enemy', src: 0, type: 'arrive' },
  { t: 1200, who: 'hero', type: 'skill', skill: 'golpe', shape: 'around', element: 'physical', hits: [{ target: 0, amount: 30, crit: true }, { target: 1, amount: 11 }], amount: 41 },
  { t: 1200, who: 'enemy', src: 0, type: 'death' },
  { t: 2000, who: 'enemy', src: 1, type: 'hit', amount: 4 },
  { t: 2500, who: 'hero', type: 'hit', shape: 'single', element: 'physical', target: 1, hits: [{ target: 1, amount: 19 }], amount: 19 },
  { t: 2500, who: 'enemy', src: 1, type: 'death' },
])

it('hurts every target of a skill, each with its own number', () => {
  const frames = timeline(pack)
  const hurt = frames.filter((f) => f.actor === 'enemy' && f.anim === 'hurt')
  expect(hurt.slice(0, 2).map((f) => [f.target, f.floater.text, f.floater.kind])).toEqual([[0, '30', 'crit'], [1, '11', 'skill']])
})

it('draws the first enemy still standing, and the last to fall at the end', () => {
  const frames = timeline(pack)
  expect(sample(frames, 500).foe).toEqual({ index: 0, sprite: 'slime', elite: true })
  // Enemy 0 dies at 1.2 s; its fall plays out before enemy 1 takes the stage.
  expect(sample(frames, 1400).foe.index).toBe(0)
  expect(sample(frames, 1400).enemy.anim).toBe('death')
  const next = sample(frames, 2200)
  expect(next.foe).toEqual({ index: 1, sprite: 'lobo-syntax', elite: false })
  expect(next.enemy.anim).not.toBe('death')
  const end = sample(frames, 5000)
  expect(end.foe.index).toBe(1)
  expect(end.enemy).toEqual({ anim: 'death', p: 1 })
})

it('shows only the numbers of the enemy on stage', () => {
  const frames = timeline(pack)
  const texts = sample(frames, 1400).floaters.map((f) => f.floater.text)
  expect(texts).toContain('30')
  expect(texts).not.toContain('11')
})

it('a log without spawns keeps the single foe behavior', () => {
  expect(sample(timeline(three), 1200).foe).toBeUndefined()
})
