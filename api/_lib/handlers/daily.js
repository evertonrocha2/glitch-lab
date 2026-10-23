import { createHash, timingSafeEqual } from 'node:crypto'
import { challengeDay, dailySummary, nextResetAt, weekEndsAt, weekStart } from '../../../shared/daily.js'
import { toPublicChallenge } from '../challenges.js'
import { fail, ok } from '../http.js'
import { ensureSet, isCurrent, runCron, toPuzzleCard, withStatus } from '../puzzles/daily.js'
import { leaderboard } from '../puzzles/leaderboard.js'
import { loadDaily } from '../puzzles/solved.js'
import { runRiddleCron } from '../riddle/daily.js'
import { runHuntCron } from '../hunt/daily.js'
import { getStore } from '../store/index.js'

// Daily and global challenges, served from /api/challenge to stay under Vercel's free-plan limit.

// GET ?daily=1: today's three puzzles, where I am on each, and my daily streak.
export async function getDaily(user, now = new Date()) {
  const store = getStore()
  const day = challengeDay(now)
  const { dailies } = await ensureSet(store, day)
  const [mine, daily] = await Promise.all([Promise.all(dailies.map((item) => store.findPuzzleChallenge(user.id, item.id))), loadDaily(store, user.id)])
  return ok({
    day,
    nextResetAt: nextResetAt(now),
    streak: dailySummary(daily.solved, day).streak,
    puzzles: dailies.map((item, index) => withStatus(toPuzzleCard(item), mine[index])),
  })
}

// GET ?global=1: this week's global challenge and its leaderboard.
export async function getGlobal(user, now = new Date()) {
  const store = getStore()
  const week = weekStart(challengeDay(now))
  const { global } = await ensureSet(store, challengeDay(now))
  const [mine, board] = await Promise.all([store.findPuzzleChallenge(user.id, global.id), leaderboard(store, global.id, user.id)])
  return ok({ week, endsAt: weekEndsAt(week), puzzle: withStatus(toPuzzleCard(global), mine), ...board })
}

// POST { daily: true, puzzleId }: my own gym challenge for a puzzle, or the one I already started.
// No AI call and no quota: the puzzle and its secret are already written.
export async function startPuzzle(user, puzzleId, now = new Date()) {
  const store = getStore()
  const puzzle = await store.getPuzzle(puzzleId)
  if (!puzzle) return fail(404, 'Challenge not found.')
  const existing = await store.findPuzzleChallenge(user.id, puzzle.id)
  if (existing) return ok({ challenge: toPublicChallenge(existing, puzzle.concept, puzzle) })
  if (!isCurrent(puzzle, now)) return fail(409, "This challenge is over. Try today's set.")

  const secret = await store.getPuzzleSecret(puzzle.id)
  const { brokenCode, symptom, language, hints } = puzzle
  const created =
    (await store.createChallenge(user.id, { caseId: null, puzzleId: puzzle.id, brokenCode, symptom, language, hints }, secret)) ??
    // A double click raced us to it: use that one.
    (await store.findPuzzleChallenge(user.id, puzzle.id))
  return ok({ challenge: toPublicChallenge(created, puzzle.concept, puzzle) }, 201)
}

const digest = (text) => createHash('sha256').update(text).digest()

// Vercel's cron sends "Authorization: Bearer <CRON_SECRET>". Compared in constant time (hashing
// first makes the lengths equal). With no secret set, only local development may run it.
export function cronAllowed(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.VERCEL !== '1'
  return timingSafeEqual(digest(request.headers.get('authorization') ?? ''), digest(`Bearer ${secret}`))
}

// GET ?cron=1: writes today's and tomorrow's puzzles and Glitchdle riddles. Reports titles and
// modes only, never solutions or answers. A Glitchdle failure never costs the puzzles their run.
export async function cron(request, now = new Date()) {
  if (!cronAllowed(request)) return fail(401, 'Not allowed.')
  const store = getStore()
  const [puzzles, riddle, hunt] = await Promise.all([
    runCron(store, now),
    runRiddleCron(store, now).catch((err) => {
      console.error('Glitchdle cron failed:', err)
      return { failed: true }
    }),
    // Line hunt: a few fresh AI snippets a day, the rest from the pool.
    runHuntCron(store, now).catch((err) => {
      console.error('Line hunt cron failed:', err)
      return { failed: true }
    }),
  ])
  return ok({ ...puzzles, riddle, hunt })
}
