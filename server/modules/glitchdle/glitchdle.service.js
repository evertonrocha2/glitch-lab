import { challengeDay, nextResetAt } from '../../../shared/daily.js'
import { compareGuess, ERROR_HINTS_AT, gameNumber, MAX_GUESSES, MODES, riddleSummary, SNIPPET_START_LINES } from '../../../shared/riddle/game.js'
import { label, languageById } from '../../../shared/riddle/languages.js'
import { badRequest, conflict } from '../../core/errors.js'
import { ensureRiddleSet } from './riddle-daily.js'
import { toResults } from './solved.js'

// Glitchdle: guess the programming language, three modes a day.
// The answer of a mode only leaves the server once that mode is over (solved, or out of guesses).

const named = (id) => ({ id, name: languageById(id)?.name ?? id })

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

// One mode as the browser sees it. Guesses come newest first.
export function publicMode(riddle, result) {
  const guesses = result?.guesses ?? []
  const solved = Boolean(result?.solved)
  const over = solved || guesses.length >= MAX_GUESSES
  const wrong = guesses.length - (solved ? 1 : 0)
  const answer = languageById(riddle.answer)
  const state = {
    mode: riddle.mode,
    solved,
    over,
    guessCount: guesses.length,
    guessesLeft: Math.max(0, MAX_GUESSES - guesses.length),
    answer: over ? named(answer.id) : null,
  }
  const newestFirst = [...guesses].reverse()
  if (riddle.mode === 'classic') {
    return { ...state, guesses: newestFirst.map((id) => ({ ...named(id), ...compareGuess(languageById(id), answer) })) }
  }
  const guessList = newestFirst.map((id) => ({ ...named(id), correct: id === answer.id }))
  if (riddle.mode === 'error') {
    const nextHint = ERROR_HINTS_AT.find((at) => at > wrong)
    return { ...state, guesses: guessList, text: riddle.payload.text, hints: errorHints(answer, wrong, over), nextHintIn: over || !nextHint ? null : nextHint - wrong }
  }
  return { ...state, guesses: guessList, lines: snippetLines(riddle.payload, wrong, over) }
}

// Today's numbers per mode: how many played and solved, and the solvers' average guesses.
export function communityNumbers(results) {
  return Object.fromEntries(
    MODES.map((mode) => {
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
  const [results, history, everyone] = await Promise.all([
    Promise.all(MODES.map((mode) => store.getRiddleResult(userId, day, mode))),
    store.listRiddleResults(userId),
    store.riddleDayResults(day),
  ])
  const { xp, played, perfectDays, streak, longestStreak, solved, distribution } = riddleSummary(toResults(history), day)
  return {
    day,
    number: gameNumber(day),
    nextResetAt: nextResetAt(now),
    modes: Object.fromEntries(MODES.map((mode, index) => [mode, publicMode(set[mode], results[index])])),
    stats: { xp, played, perfectDays, streak, longestStreak, solved, distribution },
    community: communityNumbers(everyone),
  }
}

// Today's game, my guesses so far, my stats and today's community numbers.
export function getRiddle(store, user, now = new Date()) {
  return gameState(store, user.id, now)
}

// { mode, guess, day? }: one guess. The server grades it and saves it, so a reload keeps the
// board. `day` (optional) catches a guess sent from yesterday's page.
export async function guessRiddle(store, user, body, now = new Date()) {
  const { mode, guess } = body ?? {}
  if (!MODES.includes(mode)) throw badRequest('Pick a game mode.')
  if (typeof guess !== 'string' || !languageById(guess)) throw badRequest('Pick a language from the list.')
  const day = challengeDay(now)
  if (body?.day !== undefined && body.day !== day) throw conflict('A new Glitchdle just started. Reload to play it.')

  const set = await ensureRiddleSet(store, day)
  const result = await store.getRiddleResult(user.id, day, mode)
  const guesses = result?.guesses ?? []
  if (result?.solved) throw conflict('You already solved this one. Come back tomorrow.')
  if (guesses.length >= MAX_GUESSES) throw conflict('No guesses left in this mode today.')
  if (guesses.includes(guess)) throw conflict('You already tried that language.')

  const correct = guess === set[mode].answer
  const saved = await store.saveRiddleResult(user.id, { day, mode, guesses: [...guesses, guess], solved: correct }, guesses.length)
  if (!saved) throw conflict('Another guess landed at the same time. Try again.')
  return { correct, ...(await gameState(store, user.id, now)) }
}
