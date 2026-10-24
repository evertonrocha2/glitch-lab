import { challengeDay, dailySummary, nextResetAt, weekEndsAt, weekStart } from '../../../shared/daily.js'
import { conflict, notFound } from '../../core/errors.js'
import { ensureSet, isCurrent } from './daily-set.js'
import { leaderboard } from './leaderboard.js'
import { loadDaily } from './solved.js'
import { challengeView, PUZZLE_NOT_FOUND, PUZZLE_OVER, playerState, toPlayerCard } from './switch.js'

export { switchPuzzle } from './switch.js'

// Today's three puzzles (in the reader's language, and in the programming language I'm on), where
// I am on each, and my daily streak.
export async function getDaily(store, user, locale = 'en', now = new Date()) {
  const day = challengeDay(now)
  const { dailies } = await ensureSet(store, day)
  const [states, daily] = await Promise.all([Promise.all(dailies.map((item) => playerState(store, user.id, item))), loadDaily(store, user.id)])
  return {
    day,
    nextResetAt: nextResetAt(now),
    streak: dailySummary(daily.solved, day).streak,
    puzzles: dailies.map((item, index) => toPlayerCard(item, states[index], locale, now)),
  }
}

// This week's global challenge and its leaderboard.
export async function getWeekly(store, user, locale = 'en', now = new Date()) {
  const week = weekStart(challengeDay(now))
  const { global } = await ensureSet(store, challengeDay(now))
  const [state, board] = await Promise.all([playerState(store, user.id, global), leaderboard(store, global, user.id)])
  return { week, endsAt: weekEndsAt(week), puzzle: toPlayerCard(global, state, locale, now), ...board }
}

// My own gym challenge for a puzzle, or the one I already started ({ challenge, created }).
// No AI call and no quota: the puzzle and its secret are already written, and so is the port when I
// switched the puzzle to another language before starting it.
export async function startPuzzle(store, user, puzzleId, locale = 'en', now = new Date()) {
  const puzzle = await store.getPuzzle(puzzleId)
  if (!puzzle) throw notFound(PUZZLE_NOT_FOUND)
  const existing = await store.findPuzzleChallenge(user.id, puzzle.id)
  if (existing) return { challenge: await challengeView(store, user.id, existing, puzzle, locale, now), created: false }
  if (!isCurrent(puzzle, now)) throw conflict(PUZZLE_OVER)

  const switched = await store.findPuzzleSwitch(user.id, puzzle.id)
  const [source, secret] = switched
    ? await Promise.all([store.getPuzzleVariant(puzzle.id, switched.toLanguage), store.getPuzzleVariantSecret(puzzle.id, switched.toLanguage)])
    : await Promise.all([puzzle, store.getPuzzleSecret(puzzle.id)])
  const { brokenCode, symptom, hints } = source
  const language = switched?.toLanguage ?? puzzle.language
  const created =
    (await store.createChallenge(user.id, { caseId: null, puzzleId: puzzle.id, brokenCode, symptom, language, hints }, secret)) ??
    // A double click raced us to it: use that one.
    (await store.findPuzzleChallenge(user.id, puzzle.id))
  return { challenge: await challengeView(store, user.id, created, puzzle, locale, now), created: true }
}
