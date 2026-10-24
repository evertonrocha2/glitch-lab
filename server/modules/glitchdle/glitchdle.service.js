import { challengeDay, nextResetAt } from '../../../shared/daily.js'
import { categoryOfSlot, itemById, SLOTS } from '../../../shared/riddle/categories.js'
import { CLASSIC_HINTS_AT, classicHints, compareGuess, ERROR_HINTS_AT, gameNumber, MAX_GUESSES, riddleSummary, SNIPPET_START_LINES } from '../../../shared/riddle/game.js'
import { label } from '../../../shared/riddle/languages.js'
import { badRequest, conflict } from '../../core/errors.js'
import { ensureRiddleSet } from './riddle-daily.js'
import { toResults } from './solved.js'

// Glitchdle: guess the programming language in three modes, plus a framework and a database, every day.
// The answer of a board only leaves the server once that board is over (solved, or out of guesses).

const itemOf = (slot, id) => itemById(categoryOfSlot(slot).id, id)
const named = (slot, id) => ({ id, name: itemOf(slot, id)?.name ?? id })

// What the API says when a guess isn't in the board's list.
const PICK = { languages: 'Pick a language from the list.', frameworks: 'Pick a framework from the list.', databases: 'Pick a database from the list.' }

function errorHints(answer, wrong, over) {
  const hints = [
    { label: 'File extension', value: answer.extension },
    { label: 'Syntax family', value: label(answer.syntax) },
  ]
  return hints.filter((_, index) => over || wrong >= ERROR_HINTS_AT[index])
}

// Snippet lines a player may see: blank ones always, then one more per wrong guess, in the
// day's reveal order. Hidden lines only say how long they are.
function snippetLines({ lines, order }, wrong, over) {
  const shown = new Set(over ? lines.keys() : order.slice(0, SNIPPET_START_LINES + wrong))
  return lines.map((text, index) => (text.trim() === '' || shown.has(index) ? { text } : { hidden: true, width: text.length }))
}

// How many more wrong guesses until the next hint, or null when there's none left (or the board is done).
function nextHintIn(thresholds, wrong, over) {
  const next = thresholds.find((at) => at > wrong)
  return over || !next ? null : next - wrong
}

// One board as the browser sees it. Guesses come newest first.
export function publicMode(riddle, result) {
  const guesses = result?.guesses ?? []
  const solved = Boolean(result?.solved)
  const over = solved || guesses.length >= MAX_GUESSES
  const wrong = guesses.length - (solved ? 1 : 0)
  const category = categoryOfSlot(riddle.mode)
  const answer = itemOf(riddle.mode, riddle.answer)
  const state = {
    mode: riddle.mode,
    category: category.id,
    solved,
    over,
    guessCount: guesses.length,
    guessesLeft: Math.max(0, MAX_GUESSES - guesses.length),
    answer: over ? named(riddle.mode, answer.id) : null,
  }
  const newestFirst = [...guesses].reverse()
  if (riddle.mode === 'classic' || category.id !== 'languages') {
    const hints = classicHints({ answer, guesses: guesses.map((id) => itemOf(riddle.mode, id)), attributes: category.attributes, wrong, over })
    return {
      ...state,
      guesses: newestFirst.map((id) => ({ ...named(riddle.mode, id), ...compareGuess(itemOf(riddle.mode, id), answer, category.attributes) })),
      hints,
      nextHintIn: nextHintIn(CLASSIC_HINTS_AT, wrong, over),
    }
  }
  const guessList = newestFirst.map((id) => ({ ...named(riddle.mode, id), correct: id === answer.id }))
  if (riddle.mode === 'error') {
    return { ...state, guesses: guessList, text: riddle.payload.text, hints: errorHints(answer, wrong, over), nextHintIn: nextHintIn(ERROR_HINTS_AT, wrong, over) }
  }
  return { ...state, guesses: guessList, lines: snippetLines(riddle.payload, wrong, over) }
}

// Today's numbers per board: how many played and solved, and the solvers' average guesses.
export function communityNumbers(results, slots = SLOTS) {
  return Object.fromEntries(
    slots.map((mode) => {
      const mine = results.filter((item) => item.mode === mode && item.guessCount > 0)
      const solvers = mine.filter((item) => item.solved)
      const average = solvers.length ? Math.round((solvers.reduce((sum, item) => sum + item.guessCount, 0) / solvers.length) * 10) / 10 : null
      return [mode, { players: mine.length, solved: solvers.length, averageGuesses: average }]
    }),
  )
}

export async function gameState(store, userId, now = new Date()) {
  const day = challengeDay(now)
  const set = await ensureRiddleSet(store, day)
  // Every board the day has (a board missing from the store is left out, see ensureRiddleSet).
  const slots = SLOTS.filter((slot) => set[slot])
  const [results, history, everyone] = await Promise.all([
    Promise.all(slots.map((slot) => store.getRiddleResult(userId, day, slot))),
    store.listRiddleResults(userId),
    store.riddleDayResults(day),
  ])
  const { xp, played, perfectDays, fullDays, streak, longestStreak, solved, distribution } = riddleSummary(toResults(history), day)
  return {
    day,
    number: gameNumber(day),
    nextResetAt: nextResetAt(now),
    modes: Object.fromEntries(slots.map((slot, index) => [slot, publicMode(set[slot], results[index])])),
    stats: { xp, played, perfectDays, fullDays, streak, longestStreak, solved, distribution },
    community: communityNumbers(everyone, slots),
  }
}

// Today's game, my guesses so far, my stats and today's community numbers.
export function getRiddle(store, user, now = new Date()) {
  return gameState(store, user.id, now)
}

// { mode, guess, day? }: one guess on one board (mode is a slot: a language mode or a category).
// The server grades it and saves it, so a reload keeps the board. `day` (optional) catches a guess
// sent from yesterday's page.
export async function guessRiddle(store, user, body, now = new Date()) {
  const { mode, guess } = body ?? {}
  if (!SLOTS.includes(mode)) throw badRequest('Pick a game mode.')
  const category = categoryOfSlot(mode)
  if (typeof guess !== 'string' || !itemById(category.id, guess)) throw badRequest(PICK[category.id])
  const day = challengeDay(now)
  if (body?.day !== undefined && body.day !== day) throw conflict('A new Glitchdle just started. Reload to play it.')

  const set = await ensureRiddleSet(store, day)
  if (!set[mode]) throw conflict('This board is not ready yet. Try again later.')
  const result = await store.getRiddleResult(user.id, day, mode)
  const guesses = result?.guesses ?? []
  if (result?.solved) throw conflict('You already solved this one. Come back tomorrow.')
  if (guesses.length >= MAX_GUESSES) throw conflict('No guesses left in this mode today.')
  if (guesses.includes(guess)) throw conflict(category.id === 'languages' ? 'You already tried that language.' : 'You already tried that one.')

  const correct = guess === set[mode].answer
  const saved = await store.saveRiddleResult(user.id, { day, mode, guesses: [...guesses, guess], solved: correct }, guesses.length)
  if (!saved) throw conflict('Another guess landed at the same time. Try again.')
  return { correct, ...(await gameState(store, user.id, now)) }
}
