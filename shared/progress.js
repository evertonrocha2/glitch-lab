import { BADGES } from './badges.js'
import { trailViews as viewTrails } from './trails.js'
import { dailySummary } from './daily.js'
import { riddleSummary } from './riddle/game.js'
import { duelSummary } from './duel.js'
import { eventsXp, NO_EVENTS } from './events.js'

export const XP = { case: 10, pass: 30, cleanPass: 15, solved: 50, note: 5, studyMinute: 1 }
export const MAX_NOTES_FOR_XP = 20
// A day only counts toward the streak with at least five minutes of study.
export const STUDY_DAY_SECONDS = 5 * 60

// Community articles: what each thing is worth, and how many of each count at most (so nobody farms XP).
export const COMMUNITY_XP = { article: 20, likeReceived: 2, validReceived: 5, comment: 2 }
export const COMMUNITY_XP_CAPS = { articles: 10, likes: 50, valid: 20, comments: 25 }
const NO_COMMUNITY = { articles: 0, likesReceived: 0, validReceived: 0, comments: 0 }
const communityXp = ({ articles, likesReceived, validReceived, comments }) =>
  Math.min(articles, COMMUNITY_XP_CAPS.articles) * COMMUNITY_XP.article +
  Math.min(likesReceived, COMMUNITY_XP_CAPS.likes) * COMMUNITY_XP.likeReceived +
  Math.min(validReceived, COMMUNITY_XP_CAPS.valid) * COMMUNITY_XP.validReceived +
  Math.min(comments, COMMUNITY_XP_CAPS.comments) * COMMUNITY_XP.comment

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
// trails: study trails, whose missions and finished-trail bonus add XP (see shared/trails.js).
// daily (optional): { solved: [{ kind, day, difficulty }] }, the daily and global puzzles passed.
// community (optional): articles written, likes and valid ratings received, comments written.
// riddle (optional): { results: [{ day, mode, guessCount, solved }] }, the Glitchdle games played.
// duel (optional): { results: [{ day, outcome, vsBot, fastestMs }] }, the duels finished (shared/duel.js).
// events (optional): community events taken part in, won, voted on and hosted (see shared/events.js).
export function computeProgress({ cases, challenges, notes, study, today, trails = [], daily, community = NO_COMMUNITY, riddle, duel, events = NO_EVENTS }) {
  // A daily or global puzzle pays its own XP (see shared/daily.js), not gym XP on top.
  const passes = challenges.filter((item) => item.status === 'passed' && !item.puzzleId)
  const puzzles = dailySummary(daily?.solved, today)
  const glitchdle = riddleSummary(riddle?.results, today)
  const duels = duelSummary(duel?.results)
  const cleanPasses = passes.filter((item) => item.hintsRevealed === 0).length
  const solved = cases.filter((item) => item.status === 'solved').length
  const totalSeconds = study.reduce((sum, entry) => sum + entry.seconds, 0)
  const { current, longest } = streaks(study, today)
  const trailViews = [...viewTrails(trails, { cases, challenges, notes, study }).values()]

  const xp =
    cases.length * XP.case +
    passes.length * XP.pass +
    cleanPasses * XP.cleanPass +
    solved * XP.solved +
    Math.min(notes.length, MAX_NOTES_FOR_XP) * XP.note +
    Math.floor(totalSeconds / 60) * XP.studyMinute +
    trailViews.reduce((sum, view) => sum + view.xp, 0) +
    puzzles.xp +
    glitchdle.xp +
    duels.xp +
    communityXp(community) +
    eventsXp(events)

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
    trailsDone: trailViews.filter((view) => view.complete).length,
    dailyLongestStreak: puzzles.longestStreak,
    globalSolved: puzzles.globalSolved,
    articles: community.articles,
    validReceived: community.validReceived,
    riddlePerfectDays: glitchdle.perfectDays,
    duelHumanWins: duels.humanWins,
    duelFastestMs: duels.fastestMs,
    eventEntries: events.entries,
    eventWins: events.first,
    eventsHosted: events.hosted,
  }

  return {
    xp,
    level: index + 1,
    title: LEVELS[index].title,
    levelXp: LEVELS[index].min,
    nextLevelXp: LEVELS[index + 1]?.min ?? null,
    streak: current,
    dailyStreak: puzzles.streak,
    todaySeconds: study.find((entry) => entry.day === today)?.seconds ?? 0,
    totalSeconds,
    badges: BADGES.map((badge) => ({ id: badge.id, earned: badge.earned(stats) })),
  }
}
