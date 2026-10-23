// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { categoryById, itemById } from '../../shared/riddle/categories.js'
import { compareGuess, gameNumber, RIDDLE_DAY_XP_CAP, riddleSummary, riddleXp } from '../../shared/riddle/game.js'
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
    // Both garbage collected.
    expect(cell(guess, 'memory').status).toBe('match')
    expect(cell(compareGuess(lang('rust'), answer), 'memory').status).toBe('miss')
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

describe('comparing a framework or database guess', () => {
  const frameworks = categoryById('frameworks').attributes
  const databases = categoryById('databases').attributes
  const framework = (id, fields = {}) => ({ ...itemById('frameworks', id), ...fields })
  const database = (id, fields = {}) => ({ ...itemById('databases', id), ...fields })

  it('marks single values in the same family as close', () => {
    const answer = framework('react', { language: 'javascript', license: 'mit', maker: 'big-tech' })
    const guess = compareGuess(framework('angular', { language: 'typescript', license: 'bsd', maker: 'company' }), answer, frameworks)
    expect(cell(guess, 'language')).toEqual({ key: 'language', value: 'typescript', status: 'partial' })
    expect(cell(guess, 'license').status).toBe('partial')
    expect(cell(guess, 'maker').status).toBe('partial')
    const far = compareGuess(framework('django', { language: 'python', license: 'gpl', maker: 'community' }), answer, frameworks)
    expect(['language', 'license', 'maker'].map((key) => cell(far, key).status)).toEqual(['miss', 'miss', 'miss'])
    // Single values with no family are just match or miss.
    expect(cell(compareGuess(framework('django', { kind: 'library' }), framework('react', { kind: 'framework' }), frameworks), 'kind').status).toBe('miss')
  })

  it('points the popularity arrow toward the answer bucket', () => {
    const answer = framework('react', { popularity: 'huge' })
    expect(cell(compareGuess(framework('htmx', { popularity: 'niche' }), answer, frameworks), 'popularity')).toEqual({ key: 'popularity', value: 'niche', status: 'miss', direction: 'higher' })
    expect(cell(compareGuess(answer, framework('htmx', { popularity: 'niche' }), frameworks), 'popularity').direction).toBe('lower')
    expect(cell(compareGuess(answer, answer, frameworks), 'popularity')).toEqual({ key: 'popularity', value: 'huge', status: 'match' })
  })

  it('grades database models as sets and C with C++ as close', () => {
    const answer = database('postgresql', { model: ['relational'], writtenIn: 'c', query: 'sql' })
    const guess = compareGuess(database('duckdb', { model: ['relational', 'columnar'], writtenIn: 'cpp', query: 'sql-dialect' }), answer, databases)
    expect(guess.cells.map((item) => item.key)).toEqual(['model', 'query', 'writtenIn', 'license', 'hosting', 'popularity', 'year'])
    expect(cell(guess, 'model').status).toBe('partial')
    expect(cell(guess, 'writtenIn').status).toBe('partial')
    expect(cell(guess, 'query').status).toBe('partial')
    expect(compareGuess(answer, answer, databases).correct).toBe(true)
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

describe('riddle summary', () => {
  const result = (day, mode, guessCount, solved = true) => ({ day, mode, guessCount, solved })
  const perfect = (day, guesses = [1, 3, 8]) => ['classic', 'error', 'snippet'].map((mode, index) => result(day, mode, guesses[index]))

  it('adds up XP, solves and a guess distribution per mode', () => {
    const summary = riddleSummary([...perfect('2026-10-20'), result('2026-10-21', 'classic', 12), result('2026-10-21', 'error', 4, false)], '2026-10-22')
    expect(summary.xp).toBe(25 + 20 + 10 + 10)
    expect(summary.solved).toEqual({ classic: 2, error: 1, snippet: 1, frameworks: 0, databases: 0 })
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

  it('caps the XP of a day and counts a full day only with every board solved', () => {
    const day = [...perfect('2026-10-20', [1, 1, 1]), result('2026-10-20', 'frameworks', 1)]
    expect(riddleSummary(day, '2026-10-22')).toMatchObject({ xp: RIDDLE_DAY_XP_CAP, fullDays: 0, perfectDays: 1 })
    const full = [...day, result('2026-10-20', 'databases', 9)]
    expect(riddleSummary(full, '2026-10-22')).toMatchObject({ xp: RIDDLE_DAY_XP_CAP, fullDays: 1 })
    // Solving a category board alone pays, but isn't a perfect day.
    expect(riddleSummary([result('2026-10-21', 'databases', 3)], '2026-10-22')).toMatchObject({ xp: 20, perfectDays: 0, fullDays: 0, played: 1 })
  })

  it('ignores slots it does not know', () => {
    expect(riddleSummary([result('2026-10-21', 'quiz', 1)], '2026-10-22')).toMatchObject({ xp: 0, played: 0 })
  })

  it('is empty without games', () => {
    expect(riddleSummary(undefined, '2026-10-22')).toMatchObject({ xp: 0, played: 0, perfectDays: 0, streak: 0, longestStreak: 0 })
  })
})
