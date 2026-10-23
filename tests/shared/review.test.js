// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  addDays,
  isDue,
  MAX_BOX,
  newReviewItem,
  REVIEW_CONCEPTS,
  REVIEW_INTERVALS,
  REVIEW_XP,
  REVIEW_XP_CARDS_PER_DAY,
  reviewDayXp,
  reviewQueue,
  reviewSummary,
  scheduleReview,
} from '../../shared/review.js'

const TODAY = '2026-10-22'

describe('the scheduler', () => {
  it('starts a new concept in box 1, due today', () => {
    const item = newReviewItem('off-by-one', TODAY)
    expect(item).toEqual({ concept: 'off-by-one', box: 1, dueDay: TODAY, lastDay: null, right: 0, wrong: 0 })
    expect(isDue(item, TODAY)).toBe(true)
  })

  it('moves a right answer up one box and waits that box interval', () => {
    let item = newReviewItem('off-by-one', TODAY)
    const seen = []
    for (let step = 0; step < 6; step++) {
      item = scheduleReview(item, true, TODAY)
      seen.push([item.box, item.dueDay])
    }
    expect(seen).toEqual([
      [2, addDays(TODAY, 3)],
      [3, addDays(TODAY, 7)],
      [4, addDays(TODAY, 14)],
      [5, addDays(TODAY, 30)],
      [5, addDays(TODAY, 30)],
      [5, addDays(TODAY, 30)],
    ])
    expect(item).toMatchObject({ right: 6, wrong: 0, lastDay: TODAY })
    expect(MAX_BOX).toBe(REVIEW_INTERVALS.length)
  })

  it('sends a wrong answer back to box 1, due tomorrow', () => {
    const item = scheduleReview({ ...newReviewItem('key-error', TODAY), box: 4, right: 3 }, false, TODAY)
    expect(item).toMatchObject({ box: 1, dueDay: '2026-10-23', right: 3, wrong: 1 })
    expect(isDue(item, TODAY)).toBe(false)
    expect(isDue(item, '2026-10-23')).toBe(true)
  })

  it('adds days across months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('the queue', () => {
  it('lists every concept met, stored or new, the most urgent first, without "other"', () => {
    const items = [
      { concept: 'key-error', box: 3, dueDay: '2026-10-20', lastDay: '2026-10-13', right: 2, wrong: 0 },
      { concept: 'async-await', box: 2, dueDay: '2026-10-25', lastDay: '2026-10-22', right: 1, wrong: 0 },
    ]
    const queue = reviewQueue(items, ['off-by-one', 'other', 'key-error', 'made-up'], TODAY)
    expect(queue.map((item) => item.concept)).toEqual(['key-error', 'off-by-one', 'async-await'])
    expect(queue.filter((item) => isDue(item, TODAY)).map((item) => item.concept)).toEqual(['key-error', 'off-by-one'])
    expect(REVIEW_CONCEPTS).not.toContain('other')
  })
})

describe('the summary', () => {
  it('pays XP per right card up to the daily cap and counts finished days', () => {
    const days = [
      { day: '2026-10-20', cards: 5, right: 4, completed: true },
      { day: '2026-10-21', cards: 30, right: 25, completed: true },
      { day: '2026-10-22', cards: 2, right: 1, completed: false },
    ]
    expect(reviewDayXp(25)).toBe(REVIEW_XP_CARDS_PER_DAY * REVIEW_XP.card)
    expect(reviewSummary(days)).toEqual({ xp: (4 + REVIEW_XP_CARDS_PER_DAY + 1) * REVIEW_XP.card, completedDays: 2 })
    expect(reviewSummary()).toEqual({ xp: 0, completedDays: 0 })
  })
})
