// @vitest-environment node
import { expect, it } from 'vitest'
import { addDays, challengeDay, DAILY_XP, dailySummary, nextResetAt, weekEndsAt, weekStart } from '../../shared/daily.js'

it('starts a new challenge day at 03:00 UTC (midnight in Brasilia)', () => {
  expect(challengeDay(new Date('2026-10-22T02:59:59Z'))).toBe('2026-10-21')
  expect(challengeDay(new Date('2026-10-22T03:00:00Z'))).toBe('2026-10-22')
  expect(challengeDay(new Date('2026-10-22T23:00:00Z'))).toBe('2026-10-22')
})

it('knows when the next set arrives', () => {
  expect(nextResetAt(new Date('2026-10-22T15:00:00Z'))).toBe('2026-10-23T03:00:00.000Z')
  expect(nextResetAt(new Date('2026-10-22T01:00:00Z'))).toBe('2026-10-22T03:00:00.000Z')
})

it('finds the Monday of a week and when that week ends', () => {
  expect(weekStart('2026-10-22')).toBe('2026-10-19')
  expect(weekStart('2026-10-19')).toBe('2026-10-19')
  expect(weekStart('2026-10-25')).toBe('2026-10-19')
  expect(weekStart('2026-10-26')).toBe('2026-10-26')
  expect(weekEndsAt('2026-10-19')).toBe('2026-10-26T03:00:00.000Z')
})

it('adds days across months', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
})

const daily = (day, difficulty = 'easy') => ({ kind: 'daily', day, difficulty })

it('adds xp per difficulty and for the global challenge', () => {
  const summary = dailySummary(
    [daily('2026-10-22', 'easy'), daily('2026-10-22', 'medium'), daily('2026-10-22', 'hard'), { kind: 'global', day: '2026-10-19', difficulty: 'hard' }],
    '2026-10-22',
  )
  expect(summary.xp).toBe(DAILY_XP.easy + DAILY_XP.medium + DAILY_XP.hard + DAILY_XP.global)
  expect(summary).toMatchObject({ globalSolved: 1, solved: { easy: 1, medium: 1, hard: 1 } })
})

it('counts the daily streak up to today or yesterday, one day per date', () => {
  const solved = [daily('2026-10-20'), daily('2026-10-21'), daily('2026-10-21', 'hard')]
  expect(dailySummary(solved, '2026-10-21')).toMatchObject({ streak: 2, longestStreak: 2 })
  expect(dailySummary(solved, '2026-10-22')).toMatchObject({ streak: 2 })
  expect(dailySummary(solved, '2026-10-23')).toMatchObject({ streak: 0, longestStreak: 2 })
  // The global challenge doesn't keep the daily streak alive.
  expect(dailySummary([{ kind: 'global', day: '2026-10-19', difficulty: 'hard' }], '2026-10-19').streak).toBe(0)
})

it('is empty without any daily input', () => {
  expect(dailySummary(undefined, '2026-10-22')).toEqual({
    xp: 0,
    streak: 0,
    longestStreak: 0,
    globalSolved: 0,
    solved: { easy: 0, medium: 0, hard: 0 },
  })
})
