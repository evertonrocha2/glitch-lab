// Spaced review (Leitner boxes). Every bug concept a student has met sits in a box from 1 to 5.
// A right answer moves it up a box, a wrong one sends it back to box 1, and each box waits longer
// before the concept comes back: 1, 3, 7, 14 and 30 days.
import { CONCEPTS } from './concepts.js'

export const REVIEW_INTERVALS = [1, 3, 7, 14, 30]
export const MAX_BOX = REVIEW_INTERVALS.length
// Cards in one session: one per due concept, the most overdue first.
export const REVIEW_SESSION_CARDS = 5
// XP per right card, and how many right cards a day pay XP (so nobody farms it).
export const REVIEW_XP = { card: 3 }
export const REVIEW_XP_CARDS_PER_DAY = 10
// The "Elephant memory" badge: this many days with a finished review.
export const ELEPHANT_DAYS = 7

// "other" is not something to remember, so it never gets a box.
export const REVIEW_CONCEPTS = CONCEPTS.map((concept) => concept.id).filter((id) => id !== 'other')

const DAY_MS = 24 * 3_600_000
const dayNumber = (day) => Date.parse(`${day}T00:00:00Z`) / DAY_MS
export const addDays = (day, count) => new Date((dayNumber(day) + count) * DAY_MS).toISOString().slice(0, 10)
export const daysBetween = (from, to) => Math.round(dayNumber(to) - dayNumber(from))

// A concept met for the first time starts in box 1, due right away.
export const newReviewItem = (concept, today) => ({ concept, box: 1, dueDay: today, lastDay: null, right: 0, wrong: 0 })

export const isDue = (item, today) => item.dueDay <= today

// The item after one answer on `today`.
export function scheduleReview(item, correct, today) {
  const box = correct ? Math.min(item.box + 1, MAX_BOX) : 1
  return {
    ...item,
    box,
    dueDay: addDays(today, REVIEW_INTERVALS[box - 1]),
    lastDay: today,
    right: item.right + (correct ? 1 : 0),
    wrong: item.wrong + (correct ? 0 : 1),
  }
}

// Every concept met, with its stored item (or a new one), the most urgent first: earliest due day,
// then the lowest box. `met` is a list of concept ids; unknown ids and "other" are left out.
export function reviewQueue(items, met, today) {
  const stored = new Map(items.map((item) => [item.concept, item]))
  const concepts = new Set([...met, ...stored.keys()].filter((id) => REVIEW_CONCEPTS.includes(id)))
  return [...concepts]
    .map((concept) => stored.get(concept) ?? newReviewItem(concept, today))
    .sort((a, b) => a.dueDay.localeCompare(b.dueDay) || a.box - b.box || a.concept.localeCompare(b.concept))
}

// The XP a day of review pays: right cards, up to the daily cap.
export const reviewDayXp = (right) => Math.min(right, REVIEW_XP_CARDS_PER_DAY) * REVIEW_XP.card

// computeProgress's `review` input is { days: [{ day, cards, right, completed }] }.
export function reviewSummary(days = []) {
  return {
    xp: days.reduce((sum, day) => sum + reviewDayXp(day.right), 0),
    completedDays: days.filter((day) => day.completed).length,
  }
}
