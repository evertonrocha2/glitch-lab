// @vitest-environment node
import { expect, it } from 'vitest'
import { activityCalendar, activityLevel, calendarDay, WEEKS } from '../../shared/activity.js'

// 2026-10-22 is a Thursday.
const TODAY = '2026-10-22'
const at = (calendar, day) => calendar.days[(Date.parse(`${day}T00:00:00Z`) - Date.parse(`${calendar.start}T00:00:00Z`)) / 86_400_000]

it('lays out 53 full weeks starting on a Sunday and ending this week', () => {
  const calendar = activityCalendar({}, TODAY)
  expect(calendar.days).toHaveLength(WEEKS * 7)
  expect(new Date(`${calendar.start}T00:00:00Z`).getUTCDay()).toBe(0)
  expect(calendarDay(calendar.start, WEEKS * 7 - 1)).toBe('2026-10-24')
  expect(calendar).toMatchObject({ total: 0, activeDays: 0, best: null })
})

it('counts cases, passed challenges, new notes and study time on their days', () => {
  const calendar = activityCalendar(
    {
      cases: [{ createdAt: '2026-10-20T10:00:00.000Z' }, { createdAt: '2026-10-20T18:00:00.000Z' }],
      challenges: [
        { status: 'passed', createdAt: '2026-10-19T09:00:00.000Z', passedAt: '2026-10-21T09:00:00.000Z' },
        { status: 'open', createdAt: '2026-10-21T09:00:00.000Z' },
      ],
      notes: [{ createdAt: '2026-10-21T12:00:00.000Z' }],
      study: [
        { day: '2026-10-22', seconds: 95 * 60 },
        { day: '2026-10-18', seconds: 10 * 60 },
        { day: '2026-10-16', seconds: 4 * 60 },
        { day: '2026-10-17', seconds: 10 * 3600 },
      ],
    },
    TODAY,
  )
  expect(at(calendar, '2026-10-20')).toBe(2)
  // The pass counts on the day it was passed, not opened; the open challenge doesn't count.
  expect(at(calendar, '2026-10-21')).toBe(2)
  expect(at(calendar, '2026-10-19')).toBe(0)
  // 95 minutes of study: the study day, plus three full half hours.
  expect(at(calendar, '2026-10-22')).toBe(4)
  // A short study day counts once; under 5 minutes it doesn't count; a huge day is capped.
  expect(at(calendar, '2026-10-18')).toBe(1)
  expect(at(calendar, '2026-10-16')).toBe(0)
  expect(at(calendar, '2026-10-17')).toBe(4)
  expect(calendar).toMatchObject({ total: 13, activeDays: 5, best: { day: '2026-10-17', count: 4 } })
})

it('ignores activity older than the graph or after today', () => {
  const calendar = activityCalendar({ cases: [{ createdAt: '2024-01-01T00:00:00.000Z' }, { createdAt: '2026-10-23T00:00:00.000Z' }] }, TODAY)
  expect(calendar.total).toBe(0)
})

it('counts a Glitchdle day once when any mode was solved', () => {
  const riddle = {
    results: [
      { day: '2026-10-21', mode: 'classic', guessCount: 3, solved: true },
      { day: '2026-10-21', mode: 'error', guessCount: 1, solved: true },
      { day: '2026-10-20', mode: 'snippet', guessCount: 30, solved: false },
    ],
  }
  const calendar = activityCalendar({ riddle }, TODAY)
  expect(at(calendar, '2026-10-21')).toBe(1)
  expect(at(calendar, '2026-10-20')).toBe(0)
  expect(calendar.total).toBe(1)
})

it('turns counts into five levels', () => {
  expect([0, 1, 2, 3, 4, 6, 7, 40].map(activityLevel)).toEqual([0, 1, 2, 2, 3, 3, 4, 4])
})

it('counts each finished duel on its day, at most three a day', () => {
  const duel = { results: [...Array(5).fill({ day: '2026-10-21', outcome: 'win', vsBot: true }), { day: '2026-10-20', outcome: 'loss', vsBot: false }] }
  const calendar = activityCalendar({ duel }, TODAY)
  expect(at(calendar, '2026-10-21')).toBe(3)
  expect(at(calendar, '2026-10-20')).toBe(1)
  expect(calendar.total).toBe(4)
})

it('counts each community event entry on its day', () => {
  const calendar = activityCalendar({ events: { days: ['2026-10-20', '2026-10-20', '2026-10-21'] } }, '2026-10-22')
  expect(calendar.total).toBe(3)
  expect(calendar.activeDays).toBe(2)
})
