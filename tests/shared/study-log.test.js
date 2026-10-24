import { expect, it } from 'vitest'
import { addDays, cleanTopic, groupStudyLog, weekSummary } from '../../shared/study-log.js'

const session = (id, day, startedAt, seconds, topic = '', source = 'timer') => ({ id, day, startedAt: `${day}T${startedAt}:00.000Z`, seconds, topic, source })

it('moves days across months and years', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
})

it('keeps a topic on one line, without extra spaces', () => {
  expect(cleanTopic('  Promises \n em   JS ')).toBe('Promises em JS')
  expect(cleanTopic(42)).toBe('')
})

it('groups the log by day, newest day first and latest session first, with each counted total', () => {
  const sessions = [
    session('a', '2026-10-20', '09:00', 600),
    session('b', '2026-10-22', '08:00', 1200),
    session('c', '2026-10-22', '14:00', 900, 'x', 'manual'),
  ]
  const days = [
    { day: '2026-10-21', seconds: 300 },
    { day: '2026-10-22', seconds: 1500 },
    { day: '2026-10-19', seconds: 0 },
  ]
  const groups = groupStudyLog(sessions, days)
  expect(groups.map((group) => [group.day, group.countedSeconds, group.sessions.map((item) => item.id)])).toEqual([
    ['2026-10-22', 1500, ['c', 'b']],
    // Counted time but no session recorded (from before the log existed).
    ['2026-10-21', 300, []],
    ['2026-10-20', 0, ['a']],
  ])
})

it('sums the week from counted time only, and ranks topics by time, ignoring case', () => {
  const sessions = [
    session('a', '2026-10-22', '09:00', 1800, 'Promises'),
    session('b', '2026-10-21', '09:00', 1200, 'promises'),
    session('c', '2026-10-20', '09:00', 2400, 'Closures', 'manual'),
    session('d', '2026-10-19', '09:00', 600, ''),
    // Older than the week.
    session('e', '2026-10-15', '09:00', 9000, 'Graphs'),
  ]
  const days = [
    { day: '2026-10-22', seconds: 1800 },
    { day: '2026-10-21', seconds: 1300 },
    { day: '2026-10-15', seconds: 9000 },
  ]
  expect(weekSummary(sessions, days, '2026-10-22')).toEqual({
    from: '2026-10-16',
    to: '2026-10-22',
    countedSeconds: 3100,
    manualSeconds: 2400,
    sessionCount: 4,
    topTopics: [
      { topic: 'Promises', seconds: 3000 },
      { topic: 'Closures', seconds: 2400 },
    ],
  })
})
