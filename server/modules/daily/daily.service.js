import { challengeDay, dailySummary, nextResetAt, weekEndsAt, weekStart } from '../../../shared/daily.js'
import { conflict, notFound } from '../../core/errors.js'
import { toPublicPuzzleChallenge } from '../challenges/challenges.model.js'
import { ensureSet, isCurrent, toPuzzleCard, withStatus } from './daily-set.js'
import { leaderboard } from './leaderboard.js'
import { loadDaily } from './solved.js'

// Today's three puzzles (in the reader's language), where I am on each, and my daily streak.
export async function getDaily(store, user, locale = 'en', now = new Date()) {
  const day = challengeDay(now)
  const { dailies } = await ensureSet(store, day)
  const [mine, daily] = await Promise.all([Promise.all(dailies.map((item) => store.findPuzzleChallenge(user.id, item.id))), loadDaily(store, user.id)])
  return {
    day,
    nextResetAt: nextResetAt(now),
    streak: dailySummary(daily.solved, day).streak,
    puzzles: dailies.map((item, index) => withStatus(toPuzzleCard(item, locale), mine[index])),
  }
}

// This week's global challenge and its leaderboard.
export async function getWeekly(store, user, locale = 'en', now = new Date()) {
  const week = weekStart(challengeDay(now))
  const { global } = await ensureSet(store, challengeDay(now))
  const [mine, board] = await Promise.all([store.findPuzzleChallenge(user.id, global.id), leaderboard(store, global.id, user.id)])
  return { week, endsAt: weekEndsAt(week), puzzle: withStatus(toPuzzleCard(global, locale), mine), ...board }
}

// My own gym challenge for a puzzle, or the one I already started ({ challenge, created }).
// No AI call and no quota: the puzzle and its secret are already written.
export async function startPuzzle(store, user, puzzleId, locale = 'en', now = new Date()) {
  const puzzle = await store.getPuzzle(puzzleId)
  if (!puzzle) throw notFound('Challenge not found.')
  const existing = await store.findPuzzleChallenge(user.id, puzzle.id)
  if (existing) return { challenge: toPublicPuzzleChallenge(existing, puzzle, locale), created: false }
  if (!isCurrent(puzzle, now)) throw conflict("This challenge is over. Try today's set.")

  const secret = await store.getPuzzleSecret(puzzle.id)
  const { brokenCode, symptom, language, hints } = puzzle
  const created =
    (await store.createChallenge(user.id, { caseId: null, puzzleId: puzzle.id, brokenCode, symptom, language, hints }, secret)) ??
    // A double click raced us to it: use that one.
    (await store.findPuzzleChallenge(user.id, puzzle.id))
  return { challenge: toPublicPuzzleChallenge(created, puzzle, locale), created: true }
}
