// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { compareGuess, gameNumber, MAX_GUESSES, riddleSummary, riddleXp, shareText } from '../../shared/riddle/game.js'
import { languageById } from '../../shared/riddle/languages.js'

const lang = (id, overrides = {}) => ({ ...languageById(id), ...overrides })
const cell = (result, key) => result.cells.find((item) => item.key === key)

describe('comparing a Classic guess', () => {
  it('marks a correct guess with every cell matching', () => {
    const result = compareGuess(lang('rust'), lang('rust'))
    expect(result.correct).toBe(true)
    expect(result.cells.map((item) => item.key)).toEqual(['paradigms', 'typing', 'strength', 'execution', 'memory', 'domains', 'syntax', 'year'])
    expect(result.cells.every((item) => item.status === 'match')).toBe(true)
  })

  it('grades lists: same set, overlap or nothing in common', () => {
    const answer = lang('python', { paradigms: ['imperative', 'functional'], domains: ['data', 'web'] })
    expect(cell(compareGuess(lang('go', { paradigms: ['functional', 'imperative'] }), answer), 'paradigms').status).toBe('match')
    expect(cell(compareGuess(lang('go', { paradigms: ['imperative'] }), answer), 'paradigms').status).toBe('partial')
    expect(cell(compareGuess(lang('go', { paradigms: ['imperative', 'functional', 'logic'] }), answer), 'paradigms').status).toBe('partial')
    expect(cell(compareGuess(lang('go', { paradigms: ['logic'] }), answer), 'paradigms').status).toBe('miss')
    expect(cell(compareGuess(lang('go', { domains: ['web'] }), answer), 'domains')).toEqual({ key: 'domains', value: ['web'], status: 'partial' })
    expect(cell(compareGuess(lang('go', { domains: ['games'] }), answer), 'domains').status).toBe('miss')
  })

  it('grades single values as match or miss', () => {
    const answer = lang('python')
    const guess = compareGuess(lang('java'), answer)
    expect(cell(guess, 'typing')).toEqual({ key: 'typing', value: 'static', status: 'miss' })
    expect(cell(guess, 'strength')).toEqual({ key: 'strength', value: 'strong', status: 'match' })
    expect(cell(guess, 'execution').status).toBe('miss')
    expect(cell(guess, 'memory').status).toBe('miss')
    expect(cell(guess, 'syntax').status).toBe('miss')
    expect(cell(compareGuess(lang('ruby'), lang('crystal')), 'syntax').status).toBe('match')
    expect(guess.correct).toBe(false)
  })

  it('points the year arrow toward the answer', () => {
    expect(cell(compareGuess(lang('c'), lang('go')), 'year')).toEqual({ key: 'year', value: 1972, status: 'miss', direction: 'higher' })
    expect(cell(compareGuess(lang('go'), lang('c')), 'year')).toEqual({ key: 'year', value: 2009, status: 'miss', direction: 'lower' })
    expect(cell(compareGuess(lang('java'), lang('ruby')), 'year')).toEqual({ key: 'year', value: 1995, status: 'match' })
  })
})

it('numbers games from the launch day', () => {
  expect(gameNumber('2026-10-22')).toBe(1)
  expect(gameNumber('2026-10-23')).toBe(2)
  expect(gameNumber('2026-11-03')).toBe(13)
})

it('pays 25 XP for a quick solve, down to 10', () => {
  expect([1, 2, 3, 4, 5, 7, 8, 30].map(riddleXp)).toEqual([25, 25, 20, 20, 15, 15, 10, 10])
})

describe('share text', () => {
  it('shows guesses per mode and a square per Classic cell, no answers', () => {
    const text = shareText({
      number: 12,
      modes: {
        classic: { solved: true, over: true, guesses: 2, rows: [['miss', 'partial', 'match'], ['match', 'match', 'match']] },
        error: { solved: false, over: true, guesses: MAX_GUESSES },
        snippet: { solved: false, over: false, guesses: 1 },
      },
    })
    expect(text).toBe('Glitchdle #12  Classic 2 · Error X · Snippet ?\n⬜\u{1F7E6}\u{1F7EA}\n\u{1F7EA}\u{1F7EA}\u{1F7EA}')
    expect(text).not.toContain('\u2014')
  })

  it('keeps long boards short and can add a link', () => {
    const rows = Array.from({ length: 11 }, () => ['miss'])
    const text = shareText({ number: 3, modes: { classic: { solved: true, over: true, guesses: 11, rows } }, url: 'https://x.dev/glitchdle' })
    const lines = text.split('\n')
    expect(lines).toHaveLength(1 + 8 + 1 + 1)
    expect(lines.at(-2)).toBe('+3 more')
    expect(lines.at(-1)).toBe('https://x.dev/glitchdle')
  })
})

describe('riddle summary', () => {
  const result = (day, mode, guessCount, solved = true) => ({ day, mode, guessCount, solved })
  const perfect = (day, guesses = [1, 3, 8]) => ['classic', 'error', 'snippet'].map((mode, index) => result(day, mode, guesses[index]))

  it('adds up XP, solves and a guess distribution per mode', () => {
    const summary = riddleSummary([...perfect('2026-10-20'), result('2026-10-21', 'classic', 12), result('2026-10-21', 'error', 4, false)], '2026-10-22')
    expect(summary.xp).toBe(25 + 20 + 10 + 10)
    expect(summary.solved).toEqual({ classic: 2, error: 1, snippet: 1 })
    expect(summary.distribution.classic).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 1])
    expect(summary.distribution.error[2]).toBe(1)
    expect(summary.played).toBe(2)
    expect(summary.perfectDays).toBe(1)
  })

  it('counts a streak of perfect days ending today or yesterday', () => {
    const days = [...perfect('2026-10-19'), ...perfect('2026-10-20'), ...perfect('2026-10-21')]
    expect(riddleSummary(days, '2026-10-22')).toMatchObject({ streak: 3, longestStreak: 3 })
    expect(riddleSummary(days, '2026-10-23')).toMatchObject({ streak: 0, longestStreak: 3 })
    expect(riddleSummary([...days, ...perfect('2026-10-22')], '2026-10-22').streak).toBe(4)
    // Two of three modes don't keep it going.
    expect(riddleSummary([...days, ...perfect('2026-10-22').slice(0, 2)], '2026-10-22').streak).toBe(3)
  })

  it('is empty without games', () => {
    expect(riddleSummary(undefined, '2026-10-22')).toMatchObject({ xp: 0, played: 0, perfectDays: 0, streak: 0, longestStreak: 0 })
  })
})
