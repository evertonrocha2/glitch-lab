import { expect, it } from 'vitest'
import { formatClock, formatDuration, localDay } from './day.js'

it('uses the local date', () => {
  expect(localDay(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05')
})

it('formats durations', () => {
  expect(formatDuration(0)).toBe('0m')
  expect(formatDuration(59 * 60)).toBe('59m')
  expect(formatDuration(3900)).toBe('1h 05m')
})

it('formats the timer face', () => {
  expect(formatClock(249)).toBe('04:09')
  expect(formatClock(3723)).toBe('1:02:03')
})
