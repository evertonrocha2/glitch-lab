// A year of activity, one count per day, for the GitHub-style graph on profiles and the progress page.
// Worked out from what's already stored, like XP: nothing to keep in sync.

export const WEEKS = 53
const DAY_MS = 24 * 3_600_000
// A study day (5 minutes, the same bar as the streak) counts once, plus one per full 30 minutes,
// at most this many a day, so a long session doesn't drown out everything else.
const STUDY_DAY_SECONDS = 5 * 60
const STUDY_BLOCK_SECONDS = 30 * 60
const MAX_STUDY_PER_DAY = 4

const dayOf = (iso) => (iso ? String(iso).slice(0, 10) : null)
const dayNumber = (day) => Date.parse(`${day}T00:00:00Z`) / DAY_MS
const dayString = (number) => new Date(number * DAY_MS).toISOString().slice(0, 10)

// The intensity shown for a count: 0 (nothing) to 4.
export function activityLevel(count) {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

// { start, days, total, activeDays, best }. `days` holds WEEKS*7 counts starting on a Sunday, the
// last week ending on the Saturday of `today`'s week (days after today stay 0).
// riddle (optional): { results } from Glitchdle; a day with any mode solved counts once.
export function activityCalendar({ cases = [], challenges = [], notes = [], study = [], riddle }, today) {
  const counts = new Map()
  const add = (day, amount = 1) => {
    if (day) counts.set(day, (counts.get(day) ?? 0) + amount)
  }
  for (const item of cases) add(dayOf(item.createdAt))
  for (const item of challenges) if (item.status === 'passed') add(dayOf(item.passedAt ?? item.createdAt))
  for (const note of notes) add(dayOf(note.createdAt))
  for (const day of new Set((riddle?.results ?? []).filter((item) => item.solved).map((item) => item.day))) add(day)
  for (const entry of study) {
    if (entry.seconds >= STUDY_DAY_SECONDS) add(entry.day, Math.min(MAX_STUDY_PER_DAY, 1 + Math.floor(entry.seconds / STUDY_BLOCK_SECONDS)))
  }

  const todayNumber = dayNumber(today)
  // getUTCDay: 0 is Sunday. The grid starts on the Sunday WEEKS-1 weeks before this week's.
  const weekday = new Date(todayNumber * DAY_MS).getUTCDay()
  const first = todayNumber - weekday - (WEEKS - 1) * 7
  const days = []
  let total = 0
  let activeDays = 0
  let best = null
  for (let index = 0; index < WEEKS * 7; index++) {
    const number = first + index
    const count = number > todayNumber ? 0 : (counts.get(dayString(number)) ?? 0)
    days.push(count)
    total += count
    if (count > 0) activeDays++
    if (count > 0 && (!best || count > best.count)) best = { day: dayString(number), count }
  }
  return { start: dayString(first), days, total, activeDays, best }
}

// The date of cell `index` in a calendar that starts on `start`.
export const calendarDay = (start, index) => dayString(dayNumber(start) + index)
