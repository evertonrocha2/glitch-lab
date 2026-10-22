import { ATTRIBUTES } from './languages.js'

// Glitchdle: a language riddle a day in three modes, the same for everyone. Days follow the daily
// challenges' clock (shared/daily.js), so both reset at midnight in Brasilia.

export const MODES = ['classic', 'error', 'snippet']
export const MODE_NAMES = { classic: 'Classic', error: 'Error', snippet: 'Snippet' }
// Game #1 was played on this day.
export const LAUNCH_DAY = '2026-10-22'
// After this many wrong guesses a mode is over and shows its answer.
export const MAX_GUESSES = 30
// Error mode: wrong guesses that unlock the first hint (file extension) and the second (syntax family).
export const ERROR_HINTS_AT = [3, 6]
// Snippet mode: lines shown before any guess; each wrong guess shows one more.
export const SNIPPET_START_LINES = 1
// The guess distribution's columns: 1 to 9 guesses, then "10+".
export const DISTRIBUTION_SIZE = 10

const DAY_MS = 24 * 3_600_000
const dayNumber = (day) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS)

export const gameNumber = (day) => dayNumber(day) - dayNumber(LAUNCH_DAY) + 1

// XP per solved mode: fewer guesses pay more, from 25 down to 10.
export const RIDDLE_XP = [
  { upTo: 2, xp: 25 },
  { upTo: 4, xp: 20 },
  { upTo: 7, xp: 15 },
  { upTo: Infinity, xp: 10 },
]
export const riddleXp = (guesses) => RIDDLE_XP.find((step) => guesses <= step.upTo).xp

// One Classic guess against the answer: a cell per attribute.
// status: 'match' (same), 'partial' (lists that overlap) or 'miss'. Years that miss say whether
// the answer is 'higher' (newer) or 'lower' (older).
export function compareGuess(guess, answer) {
  const cells = ATTRIBUTES.map(({ key, kind }) => {
    const value = guess[key]
    const target = answer[key]
    if (kind === 'set') {
      const shared = value.filter((item) => target.includes(item)).length
      const same = shared === value.length && shared === target.length
      return { key, value, status: same ? 'match' : shared > 0 ? 'partial' : 'miss' }
    }
    if (kind === 'year') {
      if (value === target) return { key, value, status: 'match' }
      return { key, value, status: 'miss', direction: target > value ? 'higher' : 'lower' }
    }
    return { key, value, status: value === target ? 'match' : 'miss' }
  })
  return { correct: guess.id === answer.id, cells }
}

const SQUARES = { match: '\u{1F7EA}', partial: '\u{1F7E6}', miss: '⬜' }
const MAX_SHARE_ROWS = 8

// A result anyone can paste without spoiling the answer: the game number, guesses per mode
// (X for a mode given up after MAX_GUESSES, ? for one still open) and a row of squares per
// Classic guess, first guess on top.
// modes: { classic: { solved, over, guesses, rows: [[status, ...], ...] }, error: {...}, snippet: {...} }
export function shareText({ number, modes, url }) {
  const score = (mode) => {
    const state = modes[mode]
    if (state?.solved) return String(state.guesses)
    return state?.over ? 'X' : '?'
  }
  const head = `Glitchdle #${number}  ${MODES.map((mode) => `${MODE_NAMES[mode]} ${score(mode)}`).join(' · ')}`
  const rows = modes.classic?.rows ?? []
  const shown = rows.slice(0, MAX_SHARE_ROWS).map((row) => row.map((status) => SQUARES[status]).join(''))
  if (rows.length > MAX_SHARE_ROWS) shown.push(`+${rows.length - MAX_SHARE_ROWS} more`)
  return [head, ...shown, ...(url ? [url] : [])].join('\n')
}

const bucket = (guesses) => Math.min(guesses, DISTRIBUTION_SIZE) - 1

// Everything a player's past games add up to. results: [{ day, mode, guessCount, solved }].
// A perfect day has all three modes solved; the streak counts perfect days in a row, ending
// today or yesterday (today isn't over yet), like the other streaks.
export function riddleSummary(results = [], today) {
  const played = new Set()
  const solvedByDay = new Map()
  const solved = { classic: 0, error: 0, snippet: 0 }
  const distribution = Object.fromEntries(MODES.map((mode) => [mode, Array(DISTRIBUTION_SIZE).fill(0)]))
  let xp = 0
  for (const item of results) {
    if (!MODES.includes(item.mode)) continue
    if (item.guessCount > 0) played.add(item.day)
    if (!item.solved) continue
    solved[item.mode]++
    distribution[item.mode][bucket(item.guessCount)]++
    xp += riddleXp(item.guessCount)
    solvedByDay.set(item.day, (solvedByDay.get(item.day) ?? 0) + 1)
  }
  const perfect = new Set([...solvedByDay].filter(([, count]) => count === MODES.length).map(([day]) => dayNumber(day)))

  let longestStreak = 0
  for (const day of perfect) {
    if (perfect.has(day - 1)) continue
    let length = 1
    while (perfect.has(day + length)) length++
    longestStreak = Math.max(longestStreak, length)
  }
  let end = dayNumber(today)
  if (!perfect.has(end)) end--
  let streak = 0
  while (perfect.has(end - streak)) streak++

  return { xp, played: played.size, perfectDays: perfect.size, streak, longestStreak, solved, distribution }
}
