import { isPuzzleLanguage, PUZZLE_LANGUAGES } from '../../../shared/daily.js'
import { AppError, badRequest, conflict, notFound } from '../../core/errors.js'
import { spendAiCall } from '../../infra/ai/quota.js'
import { toPublicPuzzleChallenge } from '../challenges/challenges.model.js'
import { isCurrent, toPuzzleCard, withStatus } from './daily-set.js'
import { generateVariant } from './puzzle-variant.js'

// Every daily and global puzzle is written in one programming language, the same for everyone.
// Each player may switch a puzzle they haven't solved to another language, once. The port is
// written by the AI on the first switch to that language and reused by everyone after.

export const PUZZLE_NOT_FOUND = 'Challenge not found.'
export const PUZZLE_OVER = "This challenge is over. Try today's set."
export const UNKNOWN_LANGUAGE = 'Pick one of the languages on the list.'
export const SAME_LANGUAGE = 'This challenge is already in that language.'
export const ALREADY_SWITCHED = 'You already switched the language of this challenge.'
export const SOLVED_NO_SWITCH = "You already solved this challenge, so its language can't change."
export const switchFailed = (language) =>
  new AppError(502, `Couldn't make this challenge in ${PUZZLE_LANGUAGES[language]} right now. Your switch is still unused, so you can try again later.`, 'SWITCH_FAILED')

// The port a challenge is on: its language differs from the puzzle's only after a switch.
export const challengeVariant = (store, record, puzzle) =>
  puzzle && record.language !== puzzle.language ? store.getPuzzleVariant(puzzle.id, record.language) : null

// Where one player is on a puzzle: { challenge, switched, variant } (each null when there's none).
export async function playerState(store, userId, puzzle) {
  const [challenge, switched] = await Promise.all([store.findPuzzleChallenge(userId, puzzle.id), store.findPuzzleSwitch(userId, puzzle.id)])
  const variant = switched ? await store.getPuzzleVariant(puzzle.id, switched.toLanguage) : null
  return { challenge, switched, variant }
}

// A switch is still open on a puzzle being played today (or this week) that the player hasn't solved.
const canSwitchOn = (puzzle, { challenge, switched }, now) => !switched && challenge?.status !== 'passed' && isCurrent(puzzle, now)

// The card for one player: in the language they're on, with where they are and their switch.
export function toPlayerCard(puzzle, state, locale = 'en', now = new Date()) {
  return {
    ...withStatus(toPuzzleCard(puzzle, locale, state.variant), state.challenge),
    switchedFrom: state.switched?.fromLanguage ?? null,
    canSwitch: canSwitchOn(puzzle, state, now),
  }
}

// One player's daily or global challenge for the browser, on the port when they switched.
export async function challengeView(store, userId, record, puzzle, locale = 'en', now = new Date()) {
  if (!puzzle) return toPublicPuzzleChallenge(record, null, locale)
  const [variant, switched] = await Promise.all([challengeVariant(store, record, puzzle), store.findPuzzleSwitch(userId, puzzle.id)])
  return toPublicPuzzleChallenge(record, puzzle, locale, {
    variant,
    switchedFrom: switched?.fromLanguage ?? null,
    canSwitch: canSwitchOn(puzzle, { challenge: record, switched }, now),
  })
}

async function savedVariant(store, puzzleId, language) {
  const variant = await store.getPuzzleVariant(puzzleId, language)
  return variant && { variant, secret: await store.getPuzzleVariantSecret(puzzleId, language) }
}

async function makeVariant({ store, ai }, puzzle, language) {
  const secret = await store.getPuzzleSecret(puzzle.id)
  let made
  try {
    made = await generateVariant(ai, { puzzle, secret, language })
  } catch (err) {
    console.error(`Port of puzzle ${puzzle.id} to ${language} failed:`, err.message)
    throw switchFailed(language)
  }
  const created = await store.createPuzzleVariant(puzzle.id, language, made.variant, made.secret)
  // Another request saved its port first: everyone plays that one.
  return created ? { variant: created, secret: made.secret } : savedVariant(store, puzzle.id, language)
}

// Ports being written right now, so players switching the same puzzle to the same language at the
// same moment share one AI call.
const writing = new Map()

// The port of a puzzle to a language, { variant, secret }: the saved one (no AI call, no quota),
// or a new one written on the switching player's quota.
async function variantFor(deps, user, puzzle, language) {
  const saved = await savedVariant(deps.store, puzzle.id, language)
  if (saved) return saved
  const key = `${puzzle.id}:${language}`
  if (!writing.has(key)) {
    await spendAiCall(deps.store, user)
    if (!writing.has(key)) writing.set(key, makeVariant(deps, puzzle, language).finally(() => writing.delete(key)))
  }
  return writing.get(key)
}

// Switches one of my puzzles to another programming language, once. Moves my open challenge to the
// port (code reset; hints revealed, attempts and start time kept). Nothing is recorded when the
// port can't be written, so the switch stays unused.
// Answers { puzzle: my card, challenge: my challenge or null, switchedFrom }.
export async function switchPuzzle(deps, user, puzzleId, body, locale = 'en', now = new Date()) {
  const { store } = deps
  const language = body?.language
  if (!isPuzzleLanguage(language)) throw badRequest(UNKNOWN_LANGUAGE)
  const puzzle = await store.getPuzzle(puzzleId)
  if (!puzzle) throw notFound(PUZZLE_NOT_FOUND)
  if (!isCurrent(puzzle, now)) throw conflict(PUZZLE_OVER)
  if (language === puzzle.language) throw badRequest(SAME_LANGUAGE)
  const { challenge, switched } = await playerState(store, user.id, puzzle)
  if (switched) throw conflict(ALREADY_SWITCHED)
  if (challenge?.status === 'passed') throw conflict(SOLVED_NO_SWITCH)

  const { variant, secret } = await variantFor(deps, user, puzzle, language)
  const { brokenCode, symptom, hints } = variant
  const moved = challenge && { id: challenge.id, brokenCode, symptom, hints, language, secret: { solution: secret.solution, bugExplanation: secret.bugExplanation } }
  const saved = await store.switchPuzzle(user.id, puzzle.id, { fromLanguage: puzzle.language, toLanguage: language }, moved)
  // A double click: the first request switched.
  if (!saved) throw conflict(ALREADY_SWITCHED)

  // Not moved: passed in the meantime, so it stays as it was solved.
  const record = challenge && (saved.challenge ?? (await store.getChallenge(user.id, challenge.id)))
  return {
    puzzle: toPlayerCard(puzzle, { challenge: record, switched: saved.switch, variant }, locale, now),
    challenge: record && (await challengeView(store, user.id, record, puzzle, locale, now)),
    switchedFrom: puzzle.language,
  }
}
