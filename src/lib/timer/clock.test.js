import { expect, it } from 'vitest'
import {
  elapsed,
  giveBack,
  heartbeat,
  idle,
  MAX_REPORT_SECONDS,
  pause,
  pendingSeconds,
  reset,
  restore,
  STALE_MS,
  start,
  takeUnsent,
  markOpening,
  runClosed,
  runMoved,
  runOpened,
  setFocus,
} from './clock.js'

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

it('sends nothing when nothing is owed', () => {
  expect(takeUnsent(idle(), T).seconds).toBe(0)
})

it('sends a long stretch in pieces instead of dropping it', () => {
  const first = takeUnsent(start(idle(), T), T + 1_000_000)
  expect(first.seconds).toBe(MAX_REPORT_SECONDS)
  expect(first.state.unsent).toBe(1000 - MAX_REPORT_SECONDS)
  expect(takeUnsent(first.state, T + 1_000_000).seconds).toBe(1000 - MAX_REPORT_SECONDS)
})

it('keeps the seconds of a failed report', () => {
  const { seconds, state } = takeUnsent(start(idle(), T), T + 60_000)
  const failed = giveBack(state, seconds)
  expect(pendingSeconds(failed, T + 70_000)).toBe(70)
})

it('owes the server what was counted before a pause and after a reset', () => {
  const paused = pause(start(idle(), T), T + 42_000)
  expect(pendingSeconds(paused, T + 100_000)).toBe(42)
  const cleared = reset(paused)
  expect(elapsed(cleared, T + 100_000)).toBe(0)
  expect(takeUnsent(cleared, T + 100_000).seconds).toBe(42)
})

it('keeps a timer running across a quick reload', () => {
  const state = heartbeat(start(idle(), T), T + 60_000)
  expect(restore(state, T + 60_000 + STALE_MS)).toBe(state)
})

it('stays running through a long network outage while the tab is alive', () => {
  // Nothing reported for 10 minutes, but the tab kept beating.
  const state = heartbeat(start(idle(), T), T + 600_000)
  expect(restore(state, T + 610_000).running).toBe(true)
})

it('pauses a timer left in a closed tab where it was last seen, keeping that time', () => {
  const state = heartbeat(start(idle(), T), T + 60_000)
  const restored = restore(state, T + 10 * 3_600_000)
  expect(restored.running).toBe(false)
  expect(elapsed(restored, T + 10 * 3_600_000)).toBe(60)
  expect(pendingSeconds(restored, T + 10 * 3_600_000)).toBe(60)
})

it('starts idle when nothing was saved', () => {
  expect(restore(null, T)).toEqual(idle())
})

// The study log: every run (start to pause) is its own session.
const FOCUS = { topic: 'Promises', caseId: 'c1', noteId: null }

it('starts a run with what it is about, waiting for its session', () => {
  const state = start(idle(), T, FOCUS)
  expect(state.focus).toEqual(FOCUS)
  expect(state.run).toMatchObject({ id: null, startedAt: T, endedAt: null, detached: false })
  // A click handler passing no focus starts with none.
  expect(start(idle(), T).focus).toBeNull()
})

it('ends the run where the timer paused, and a resume opens a new one with the same topic', () => {
  const opened = runOpened(start(idle(), T, FOCUS), { startedAt: T }, 's1')
  const paused = pause(opened, T + 90_000)
  expect(paused.run).toMatchObject({ id: 's1', endedAt: T + 90_000 })
  const closed = runClosed(paused, paused.run)
  expect(closed.run).toBeNull()
  const resumed = start(closed, T + 200_000)
  expect(resumed.focus).toEqual(FOCUS)
  expect(resumed.run).toMatchObject({ id: null, startedAt: T + 200_000 })
})

it('keeps a stopped run until the server closes it, and never closes a running one', () => {
  const opened = runOpened(start(idle(), T), { startedAt: T }, 's1')
  expect(runClosed(opened, opened.run)).toBe(opened)
  const cleared = reset(pause(opened, T + 70_000))
  expect(cleared.focus).toBeNull()
  expect(cleared.run).toMatchObject({ id: 's1', endedAt: T + 70_000 })
})

it('ends the run of a closed tab at its last heartbeat', () => {
  const state = heartbeat(runOpened(start(idle(), T), { startedAt: T }, 's1'), T + 45_000)
  const restored = restore(state, T + 3_600_000)
  expect(restored.run).toMatchObject({ id: 's1', endedAt: T + 45_000 })
})

it('ignores answers about an older run', () => {
  const state = start(idle(), T + 100_000)
  expect(runOpened(state, { startedAt: T }, 'old')).toBe(state)
  expect(markOpening(state, { startedAt: T }, T)).toBe(state)
  expect(markOpening(state, state.run, T + 100_000).run).toMatchObject({ opening: T + 100_000, tries: 1 })
})

it('follows the session the server says to report to next', () => {
  const opened = runOpened(start(idle(), T), { startedAt: T }, 's1')
  expect(runMoved(opened, 's1', 's2').run).toMatchObject({ id: 's2', detached: false })
  expect(runMoved(opened, 's1', null).run).toMatchObject({ id: null, detached: true })
  expect(runMoved(opened, 'other', 's2')).toBe(opened)
})

it('changes the topic without touching the clock', () => {
  const state = start(idle(), T, FOCUS)
  const edited = setFocus(state, { topic: 'Closures' })
  expect(edited.focus).toEqual({ ...FOCUS, topic: 'Closures' })
  expect(elapsed(edited, T + 5_000)).toBe(5)
})
