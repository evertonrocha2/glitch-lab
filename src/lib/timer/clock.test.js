import { expect, it } from 'vitest'
import { elapsed, idle, MAX_REPORT_SECONDS, pause, restore, STALE_MS, start, takeUnsent } from './clock.js'

const T = 1_000_000

it('counts while running and holds while paused', () => {
  let state = start(idle(), T)
  expect(elapsed(state, T + 90_000)).toBe(90)
  state = pause(state, T + 90_000)
  expect(elapsed(state, T + 500_000)).toBe(90)
  state = start(state, T + 500_000)
  expect(elapsed(state, T + 510_000)).toBe(100)
})

it('hands out whole unsent seconds and keeps the fraction for later', () => {
  const state = start(idle(), T)
  const first = takeUnsent(state, T + 61_500)
  expect(first.seconds).toBe(61)
  expect(first.state.lastSentAt).toBe(T + 61_000)
  expect(takeUnsent(first.state, T + 61_900).seconds).toBe(0)
  expect(takeUnsent(first.state, T + 62_000).seconds).toBe(1)
})

it('sends nothing while paused', () => {
  expect(takeUnsent(idle(), T).seconds).toBe(0)
})

it('never reports more than the server takes at once', () => {
  const { seconds, state } = takeUnsent(start(idle(), T), T + 3_600_000)
  expect(seconds).toBe(MAX_REPORT_SECONDS)
  expect(state.lastSentAt).toBe(T + 3_600_000)
})

it('keeps a timer running across a quick reload', () => {
  const state = { ...start(idle(), T), lastSentAt: T + 60_000 }
  expect(restore(state, T + 60_000 + STALE_MS)).toBe(state)
})

it('pauses a timer left running in a closed tab at its last report', () => {
  const state = { ...start(idle(), T), lastSentAt: T + 60_000 }
  const restored = restore(state, T + 10 * 3_600_000)
  expect(restored.running).toBe(false)
  expect(elapsed(restored, T + 10 * 3_600_000)).toBe(60)
})

it('starts idle when nothing was saved', () => {
  expect(restore(null, T)).toEqual(idle())
})
