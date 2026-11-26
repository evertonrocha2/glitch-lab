import { expect, it } from 'vitest'
import { duration, HUNT_SPEED } from './playback.js'

const fight = (log, extra = {}) => ({ won: true, reason: 'killed', ms: 3000, heroHpLeft: 10, potionsUsed: { hp: 0, mp: 0 }, log, ...extra })
const three = fight([
  { t: 1000, who: 'hero', type: 'hit', amount: 12, element: 'physical' },
  { t: 1500, who: 'enemy', type: 'hit', amount: 5 },
  { t: 2000, who: 'hero', type: 'hit', amount: 12, element: 'physical' },
])

it('lasts the fight plus a beat for the last fall, divided by speed', () => {
  expect(duration(three, { speed: 1 })).toBeGreaterThan(3000)
  expect(duration(three, { speed: 3 })).toBeCloseTo(duration(three, { speed: 1 }) / 3)
})

it('handles empty logs and timeouts without a terminal event', () => {
  expect(duration(fight([], { won: false, reason: 'timeout', ms: 60000 }))).toBeGreaterThanOrEqual(60000)
  expect(duration(null)).toBeGreaterThan(0)
})

it('replays hunt packs a bit faster than real time', () => {
  expect(HUNT_SPEED).toBeGreaterThan(1)
  expect(HUNT_SPEED).toBeLessThanOrEqual(2)
})
