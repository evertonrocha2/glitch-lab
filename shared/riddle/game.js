import { SLOTS } from './slots.js'
import { ATTRIBUTES } from './languages.js'

// Glitchdle: a riddle a day per board, the same for everyone: the language in three modes, plus a
// framework and a database. Days follow the daily challenges' clock (shared/daily.js), so both
// reset at midnight in Brasilia. A "slot" is one board of the day (shared/riddle/categories.js).

// The language modes. SLOTS (categories.js) adds a slot per other category.
export const MODES = ['classic', 'error', 'snippet']
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

// XP per solved board: fewer guesses pay more, from 25 down to 10.
export const RIDDLE_XP = [
  { upTo: 2, xp: 25 },
  { upTo: 4, xp: 20 },
  { upTo: 7, xp: 15 },
  { upTo: Infinity, xp: 10 },
]
export const riddleXp = (guesses) => RIDDLE_XP.find((step) => guesses <= step.upTo).xp
// Five boards a day could pay 125 XP; a day pays at most this, so Glitchdle stays one source of
// XP among many. Each board is solved once a day at most, so there's nothing else to farm.
export const RIDDLE_DAY_XP_CAP = 100

const familyOf = (family, value) => (family ? (family[value] ?? null) : null)

// One classic guess against the answer: a cell per attribute.
// status: 'match' (same), 'partial' (lists that overlap, or values in the same family) or 'miss'.
// Years that miss say whether the answer is 'higher' (newer) or 'lower' (older); ranks the same
// for a higher or lower bucket.
export function compareGuess(guess, answer, attributes = ATTRIBUTES) {
  const cells = attributes.map(({ key, kind, family, values }) => {
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
    if (kind === 'rank') {
      if (value === target) return { key, value, status: 'match' }
      return { key, value, status: 'miss', direction: values.indexOf(target) > values.indexOf(value) ? 'higher' : 'lower' }
    }
    if (value === target) return { key, value, status: 'match' }
    const near = familyOf(family, value) !== null && familyOf(family, value) === familyOf(family, target)
    return { key, value, status: near ? 'partial' : 'miss' }
  })
  return { correct: guess.id === answer.id, cells }
}

const bucket = (guesses) => Math.min(guesses, DISTRIBUTION_SIZE) - 1

// Everything a player's past games add up to. results: [{ day, mode, guessCount, solved }], where
// mode is a slot. A perfect day has the three language modes solved (the "Lingo master" badge and
// the streak); a full day has every board solved (the "Full stack" badge). The streak counts
// perfect days in a row, ending today or yesterday (today isn't over yet), like the other streaks.
export function riddleSummary(results = [], today) {
  const played = new Set()
  const solvedByDay = new Map()
  const xpByDay = new Map()
  const solved = Object.fromEntries(SLOTS.map((slot) => [slot, 0]))
  const distribution = Object.fromEntries(SLOTS.map((slot) => [slot, Array(DISTRIBUTION_SIZE).fill(0)]))
  for (const item of results) {
    if (!SLOTS.includes(item.mode)) continue
    if (item.guessCount > 0) played.add(item.day)
    if (!item.solved) continue
    solved[item.mode]++
    distribution[item.mode][bucket(item.guessCount)]++
    xpByDay.set(item.day, (xpByDay.get(item.day) ?? 0) + riddleXp(item.guessCount))
    const day = solvedByDay.get(item.day) ?? new Set()
    day.add(item.mode)
    solvedByDay.set(item.day, day)
  }
  const xp = [...xpByDay.values()].reduce((sum, value) => sum + Math.min(value, RIDDLE_DAY_XP_CAP), 0)
  const perfect = new Set([...solvedByDay].filter(([, slots]) => MODES.every((mode) => slots.has(mode))).map(([day]) => dayNumber(day)))
  const fullDays = [...solvedByDay.values()].filter((slots) => SLOTS.every((slot) => slots.has(slot))).length

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

  return { xp, played: played.size, perfectDays: perfect.size, fullDays, streak, longestStreak, solved, distribution }
}
