import { afterEach, expect, it } from 'vitest'
import { frameStats, installFpsMeter, longTaskStats } from './fps-meter.js'

let uninstall = () => {}
afterEach(() => uninstall())

it('reads fps, the worst frame and dropped frames from the frame gaps', () => {
  const smooth = Array.from({ length: 60 }, () => 1000 / 60)
  expect(frameStats(smooth)).toEqual({ fps: 60, worst: 17, dropped: 0 })
  // A 180 Hz screen with one 50 ms hitch: that frame took 9 refreshes, so 8 were dropped.
  const hitch = [...Array.from({ length: 170 }, () => 1000 / 180), 50]
  expect(frameStats(hitch)).toMatchObject({ worst: 50, dropped: 8 })
  expect(frameStats([])).toEqual({ fps: 0, worst: 0, dropped: 0 })
})

it('counts only the long tasks of the last five seconds', () => {
  const tasks = [
    { duration: 80, end: 1000 },
    { duration: 120, end: 9000 },
    { duration: 60, end: 9500 },
  ]
  expect(longTaskStats(tasks, 10_000)).toEqual({ count: 2, total: 180 })
})

it('shows and hides with Ctrl+Shift+F', () => {
  uninstall = installFpsMeter()
  const press = () => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', ctrlKey: true, shiftKey: true }))
  expect(document.querySelector('[data-testid="fps-meter"]')).toBeNull()
  press()
  expect(document.querySelector('[data-testid="fps-meter"]')).toHaveTextContent('fps')
  press()
  expect(document.querySelector('[data-testid="fps-meter"]')).toBeNull()
})
