// The study log: timer sessions (one per run of the timer) and sessions logged by hand.
// Shared by the API (validation) and the /study page (grouping and the week summary).

export const STUDY_LOG = {
  // Characters in a topic.
  topic: 120,
  // A timer run shorter than this isn't kept: opening a tab and pausing isn't a session.
  minSessionSeconds: 60,
  // A session logged by hand: from 5 minutes to 4 hours, on today or one of the 6 days before.
  manualMinMinutes: 5,
  manualMaxMinutes: 240,
  manualDays: 7,
  // Demo accounts are throwaway: they can log, but not without end.
  demoSessionsPerDay: 50,
  // The longest range one list request may ask for.
  maxRangeDays: 92,
}

const DAY_MS = 86_400_000
const dayTime = (day) => Date.parse(`${day}T00:00:00Z`)

// '2026-10-22' plus or minus whole days, in plain calendar terms (no time zone involved).
export const addDays = (day, count) => new Date(dayTime(day) + count * DAY_MS).toISOString().slice(0, 10)

// One line, no runs of spaces: what the student typed, as it will be shown.
export const cleanTopic = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')

// The log as the page shows it: one entry per day (newest first) that has sessions or counted time,
// with the day's counted seconds (study_time, the only time that gives XP) and its sessions, latest first.
export function groupStudyLog(sessions, days) {
  const byDay = new Map()
  const entry = (day) => {
    if (!byDay.has(day)) byDay.set(day, { day, countedSeconds: 0, sessions: [] })
    return byDay.get(day)
  }
  for (const item of days) if (item.seconds > 0) entry(item.day).countedSeconds = item.seconds
  for (const session of sessions) entry(session.day).sessions.push(session)
  for (const group of byDay.values()) group.sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day))
}

// The last 7 days (today and the 6 before): counted time, time logged by hand (shown apart, it
// counts for nothing), and the topics studied the most, by time, ignoring case.
export function weekSummary(sessions, days, today, { top = 3 } = {}) {
  const from = addDays(today, -6)
  const inWeek = (day) => day >= from && day <= today
  const countedSeconds = days.filter((item) => inWeek(item.day)).reduce((sum, item) => sum + item.seconds, 0)
  const week = sessions.filter((session) => inWeek(session.day))
  const manualSeconds = week.filter((session) => session.source === 'manual').reduce((sum, session) => sum + session.seconds, 0)
  const topics = new Map()
  for (const session of week) {
    const topic = cleanTopic(session.topic)
    if (!topic || session.seconds <= 0) continue
    const key = topic.toLowerCase()
    const found = topics.get(key) ?? { topic, seconds: 0 }
    found.seconds += session.seconds
    topics.set(key, found)
  }
  const topTopics = [...topics.values()].sort((a, b) => b.seconds - a.seconds || a.topic.localeCompare(b.topic)).slice(0, top)
  return { from, to: today, countedSeconds, manualSeconds, sessionCount: week.length, topTopics }
}
