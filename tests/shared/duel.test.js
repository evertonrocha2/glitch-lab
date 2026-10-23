// @vitest-environment node
import { expect, it } from 'vitest'
import { BOT_XP_PER_DAY, duelSummary, eloRating, HUMAN_XP_PER_DAY, ROUND_MS, roundPoints } from '../../shared/duel.js'

it('scores 0 for wrong, voided or missing answers, and 100 plus a speed bonus otherwise', () => {
  expect(roundPoints({ correct: false, ms: 500 })).toBe(0)
  expect(roundPoints({ correct: true, ms: 500, left: true })).toBe(0)
  expect(roundPoints({ correct: true, ms: null })).toBe(0)
  expect(roundPoints({ correct: true, ms: 0 })).toBe(200)
  expect(roundPoints({ correct: true, ms: ROUND_MS / 2 })).toBe(150)
  expect(roundPoints({ correct: true, ms: ROUND_MS })).toBe(100)
  // Never below the base, even a hair late.
  expect(roundPoints({ correct: true, ms: ROUND_MS + 400 })).toBe(100)
  expect(roundPoints({ correct: true, ms: 3_000 })).toBe(180)
})

it('moves Elo ratings by K=32 around the expected score', () => {
  expect(eloRating(1000, 1000, 1)).toBe(1016)
  expect(eloRating(1000, 1000, 0)).toBe(984)
  expect(eloRating(1000, 1000, 0.5)).toBe(1000)
  // Beating a much stronger player pays more than beating an equal one.
  expect(eloRating(1000, 1400, 1)).toBe(1029)
  expect(eloRating(1400, 1000, 0)).toBe(1371)
})

it('pays XP per duel, half against the bot, capped per day', () => {
  const day = '2026-10-22'
  expect(duelSummary([])).toEqual({ xp: 0, played: 0, wins: 0, humanWins: 0, fastestMs: null })
  const human = [
    { day, outcome: 'win', vsBot: false, fastestMs: 2400 },
    { day, outcome: 'draw', vsBot: false, fastestMs: null },
    { day, outcome: 'loss', vsBot: false, fastestMs: 1800 },
    { day, outcome: 'forfeit', vsBot: false, fastestMs: null },
  ]
  expect(duelSummary(human)).toEqual({ xp: 40 + 25 + 10, played: 4, wins: 1, humanWins: 1, fastestMs: 1800 })

  const bots = Array.from({ length: BOT_XP_PER_DAY + 2 }, () => ({ day, outcome: 'win', vsBot: true, fastestMs: 5000 }))
  expect(duelSummary(bots)).toMatchObject({ xp: BOT_XP_PER_DAY * 20, wins: bots.length, humanWins: 0 })
  // The cap is per day.
  expect(duelSummary([...bots, { day: '2026-10-23', outcome: 'loss', vsBot: true }]).xp).toBe(BOT_XP_PER_DAY * 20 + 5)

  const many = Array.from({ length: HUMAN_XP_PER_DAY + 1 }, () => ({ day, outcome: 'win', vsBot: false }))
  expect(duelSummary(many).xp).toBe(HUMAN_XP_PER_DAY * 40)
})
