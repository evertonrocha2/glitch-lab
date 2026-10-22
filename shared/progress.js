import { BADGES } from './badges.js'

export const XP = { case: 10, pass: 30, cleanPass: 15, solved: 50, note: 5, studyMinute: 1 }
export const MAX_NOTES_FOR_XP = 20
// A day only counts toward the streak with at least five minutes of study.
export const STUDY_DAY_SECONDS = 5 * 60

export const LEVELS = [
  { min: 0, title: 'Rookie' },
  { min: 100, title: 'Junior Detective' },
  { min: 300, title: 'Detective' },
  { min: 600, title: 'Inspector' },
  { min: 1000, title: 'Chief Inspector' },
  { min: 1500, title: 'Bug Whisperer' },
]

const DAY_MS = 24 * 3_600_000
const dayNumber = (day) => Date.parse(`${day}T00:00:00Z`) / DAY_MS

function streaks(study, today) {
  const days = new Set(study.filter((entry) => entry.seconds >= STUDY_DAY_SECONDS).map((entry) => dayNumber(entry.day)))
  let longest = 0
  for (const day of days) {
    if (days.has(day - 1)) continue
    let length = 1
    while (days.has(day + length)) length++
    longest = Math.max(longest, length)
  }
  // The current streak may end today or yesterday (today isn't over yet).
  let end = dayNumber(today)
  if (!days.has(end)) end--
  let current = 0
  while (days.has(end - current)) current++
  return { current, longest }
}

// Everything is derived from what's already stored, so there's nothing to keep in sync.
export function computeProgress({ cases, challenges, notes, study, today }) {
  const passes = challenges.filter((item) => item.status === 'passed')
  const cleanPasses = passes.filter((item) => item.hintsRevealed === 0).length
  const solved = cases.filter((item) => item.status === 'solved').length
  const totalSeconds = study.reduce((sum, entry) => sum + entry.seconds, 0)
  const { current, longest } = streaks(study, today)

  const xp =
    cases.length * XP.case +
    passes.length * XP.pass +
    cleanPasses * XP.cleanPass +
    solved * XP.solved +
    Math.min(notes.length, MAX_NOTES_FOR_XP) * XP.note +
    Math.floor(totalSeconds / 60) * XP.studyMinute

  const index = LEVELS.findLastIndex((level) => xp >= level.min)
  const stats = {
    cases: cases.length,
    passes: passes.length,
    cleanPasses,
    solved,
    languages: new Set(cases.map((item) => item.language)).size,
    linkedNotes: notes.filter((note) => note.blocks.some((block) => block.type === 'case')).length,
    bestDaySeconds: Math.max(0, ...study.map((entry) => entry.seconds)),
    totalSeconds,
    longestStreak: longest,
  }

  return {
    xp,
    level: index + 1,
    title: LEVELS[index].title,
    levelXp: LEVELS[index].min,
    nextLevelXp: LEVELS[index + 1]?.min ?? null,
    streak: current,
    todaySeconds: study.find((entry) => entry.day === today)?.seconds ?? 0,
    totalSeconds,
    badges: BADGES.map((badge) => ({ id: badge.id, earned: badge.earned(stats) })),
  }
}
