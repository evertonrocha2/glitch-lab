// Line hunt: a short snippet, a one-line symptom, and 20 seconds to tap the line that holds the bug.
// A daily run is 8 snippets, the same for everyone that day, on the daily challenges' clock
// (shared/daily.js). The server times every round: it stamps when a snippet was served and when the
// answer arrived, so a slow network costs a little speed bonus, never the answer itself.

export const HUNT_ROUNDS = 8
export const ROUND_MS = 20_000
// An answer may arrive this long after the round ran out (the trip to the server) and still count.
export const ANSWER_GRACE_MS = 2_000
// A right line scores BASE_POINTS plus up to SPEED_POINTS, less the slower it came.
export const BASE_POINTS = 100
export const SPEED_POINTS = 50
export const MAX_SCORE = HUNT_ROUNDS * (BASE_POINTS + SPEED_POINTS)

// Snippets are 6 to 15 lines long.
export const MIN_LINES = 6
export const MAX_LINES = 15

// The languages a snippet can be written in (ids from shared/riddle/languages.js).
export const HUNT_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'c', 'go', 'ruby', 'csharp', 'php', 'kotlin', 'rust']

// Points for one round: nothing for a wrong line or a timeout, otherwise the base plus the share of
// the speed bonus that was left when the answer arrived.
export function roundPoints(correct, ms) {
  if (!correct) return 0
  const left = Math.max(0, ROUND_MS - Math.max(0, Math.min(ms, ROUND_MS)))
  return BASE_POINTS + Math.round((SPEED_POINTS * left) / ROUND_MS)
}

// XP for a daily run: 5 per right line and 10 more for a perfect run, never above MAX_HUNT_XP.
// Practice runs pay nothing.
export const HUNT_XP = { line: 5, perfect: 10 }
export const MAX_HUNT_XP = 50
export const huntXp = (correct) => Math.min(MAX_HUNT_XP, Math.max(0, correct) * HUNT_XP.line + (correct >= HUNT_ROUNDS ? HUNT_XP.perfect : 0))

// What progress reads from a player's runs ([{ day, correct, answered }]): the XP, the perfect runs
// (the eagle-eye badge) and the days played (the activity graph).
export function huntSummary(runs = []) {
  return {
    xp: runs.reduce((sum, run) => sum + huntXp(run.correct), 0),
    perfectRuns: runs.filter((run) => run.correct >= HUNT_ROUNDS).length,
    days: [...new Set(runs.filter((run) => run.answered > 0).map((run) => run.day))],
  }
}

// The leaderboard's order: more points, then more right lines, then less time spent, then whoever
// finished first.
export const compareRuns = (a, b) => b.score - a.score || b.correct - a.correct || a.ms - b.ms || String(a.finishedAt).localeCompare(String(b.finishedAt))
