// Daily and global challenges: the same puzzles for everyone, on one clock.
// A challenge day starts at 03:00 UTC (midnight in Brasilia), when the cron writes the new set.
export const RESET_HOUR_UTC = 3
export const DIFFICULTIES = ['easy', 'medium', 'hard']
export const DAILY_XP = { easy: 20, medium: 35, hard: 50, global: 100 }

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
const dayNumber = (day) => Date.parse(`${day}T00:00:00Z`) / DAY_MS

export const addDays = (day, count) => new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY_MS).toISOString().slice(0, 10)

export const challengeDay = (now = new Date()) => new Date(now.getTime() - RESET_HOUR_UTC * HOUR_MS).toISOString().slice(0, 10)

const resetOf = (day) => new Date(Date.parse(`${day}T00:00:00Z`) + RESET_HOUR_UTC * HOUR_MS).toISOString()

// When today's set is replaced by the next one.
export const nextResetAt = (now = new Date()) => resetOf(addDays(challengeDay(now), 1))

// The global challenge runs Monday to Sunday; its `day` is the Monday.
export function weekStart(day) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
  return addDays(day, -((weekday + 6) % 7))
}

export const weekEndsAt = (monday) => resetOf(addDays(monday, 7))

// XP, streak and counts from the puzzles a student passed: [{ kind, day, difficulty }].
// Only dailies keep the streak going: a day counts with at least one of them solved.
export function dailySummary(solved = [], today) {
  const dailies = solved.filter((item) => item.kind === 'daily')
  const days = new Set(dailies.map((item) => dayNumber(item.day)))
  let longestStreak = 0
  for (const day of days) {
    if (days.has(day - 1)) continue
    let length = 1
    while (days.has(day + length)) length++
    longestStreak = Math.max(longestStreak, length)
  }
  // Like the study streak, the current one may end yesterday: today isn't over yet.
  let end = dayNumber(today)
  if (!days.has(end)) end--
  let streak = 0
  while (days.has(end - streak)) streak++

  const count = (difficulty) => dailies.filter((item) => item.difficulty === difficulty).length
  const globalSolved = solved.length - dailies.length
  const solvedBy = { easy: count('easy'), medium: count('medium'), hard: count('hard') }
  const xp = DIFFICULTIES.reduce((sum, level) => sum + solvedBy[level] * DAILY_XP[level], 0) + globalSolved * DAILY_XP.global
  return { xp, streak, longestStreak, globalSolved, solved: solvedBy }
}

// The programming languages a daily or global puzzle can be switched to, with their display names.
// Each player may move a puzzle to one other language, once (see server/modules/daily/switch.js).
export const PUZZLE_LANGUAGES = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  csharp: 'C#',
  go: 'Go',
  ruby: 'Ruby',
  php: 'PHP',
  c: 'C',
  cpp: 'C++',
  kotlin: 'Kotlin',
  rust: 'Rust',
  swift: 'Swift',
}

export const isPuzzleLanguage = (id) => typeof id === 'string' && Object.hasOwn(PUZZLE_LANGUAGES, id)
