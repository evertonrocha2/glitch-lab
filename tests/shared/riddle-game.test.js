// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { categoryById, itemById } from '../../shared/riddle/categories.js'
import { CLASSIC_HINTS_AT, classicHints, compareGuess, gameNumber, MAX_GUESSES, RIDDLE_DAY_XP_CAP, riddleSummary, riddleXp } from '../../shared/riddle/game.js'
import { ATTRIBUTES, languageById } from '../../shared/riddle/languages.js'

const lang = (id, overrides = {}) => ({ ...languageById(id), ...overrides })
const cell = (result, key) => result.cells.find((item) => item.key === key)

describe('comparing a Classic guess', () => {
  it('marks a correct guess with every cell matching', () => {
    const result = compareGuess(lang('rust'), lang('rust'))
    expect(result.correct).toBe(true)
    expect(result.cells.map((item) => item.key)).toEqual([
      'paradigms',
      'typing',
      'strength',
      'execution',
      'runtime',
      'memory',
      'domains',
      'syntax',
      'indentation',
      'standard',
      'popularity',
      'year',
    ])
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

  it('grades the runtime: same, both on a virtual machine, or different', () => {
    expect(cell(compareGuess(lang('kotlin'), lang('java')), 'runtime')).toEqual({ key: 'runtime', value: 'jvm', status: 'match' })
    expect(cell(compareGuess(lang('csharp'), lang('java')), 'runtime')).toEqual({ key: 'runtime', value: 'dotnet', status: 'partial' })
    expect(cell(compareGuess(lang('elixir'), lang('javascript')), 'runtime').status).toBe('partial')
    expect(cell(compareGuess(lang('c'), lang('python')), 'runtime')).toEqual({ key: 'runtime', value: 'native', status: 'miss' })
    expect(cell(compareGuess(lang('python'), lang('sql')), 'runtime').status).toBe('miss')
  })

  it('grades significant indentation and ISO or Ecma standards as yes or no', () => {
    expect(cell(compareGuess(lang('haskell'), lang('python')), 'indentation')).toEqual({ key: 'indentation', value: 'yes', status: 'match' })
    expect(cell(compareGuess(lang('ruby'), lang('python')), 'indentation')).toEqual({ key: 'indentation', value: 'no', status: 'miss' })
    expect(cell(compareGuess(lang('ruby'), lang('c')), 'standard')).toEqual({ key: 'standard', value: 'yes', status: 'match' })
    expect(cell(compareGuess(lang('java'), lang('c')), 'standard')).toEqual({ key: 'standard', value: 'no', status: 'miss' })
  })

  it('points the Stack Overflow arrow toward the answer bucket', () => {
    expect(lang('python').popularity).toBe('huge')
    expect(lang('rust').popularity).toBe('known')
    expect(cell(compareGuess(lang('rust'), lang('python')), 'popularity')).toEqual({ key: 'popularity', value: 'known', status: 'miss', direction: 'higher' })
    expect(cell(compareGuess(lang('python'), lang('zig')), 'popularity')).toEqual({ key: 'popularity', value: 'huge', status: 'miss', direction: 'lower' })
    expect(cell(compareGuess(lang('java'), lang('python')), 'popularity')).toEqual({ key: 'popularity', value: 'huge', status: 'match' })
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

  it("grades a framework's runtime and typing, which follow its language", () => {
    const answer = framework('laravel')
    const guess = compareGuess(framework('django'), answer, frameworks)
    expect(cell(guess, 'runtime')).toEqual({ key: 'runtime', value: 'interpreter', status: 'match' })
    expect(cell(guess, 'typing')).toEqual({ key: 'typing', value: 'dynamic', status: 'match' })
    expect(cell(guess, 'language').status).toBe('miss')
    const jvm = compareGuess(framework('spring-boot'), answer, frameworks)
    expect(cell(jvm, 'runtime')).toEqual({ key: 'runtime', value: 'jvm', status: 'miss' })
    expect(cell(jvm, 'typing')).toEqual({ key: 'typing', value: 'static', status: 'miss' })
    // The JVM and .NET are both virtual machines: close.
    expect(cell(compareGuess(framework('spring-boot'), framework('asp-net-core'), frameworks), 'runtime').status).toBe('partial')
  })

  it('points the Wikipedias arrow toward the answer bucket', () => {
    const answer = framework('react', { wikipedias: 'top' })
    expect(cell(compareGuess(framework('gin', { wikipedias: 'low' }), answer, frameworks), 'wikipedias')).toEqual({ key: 'wikipedias', value: 'low', status: 'miss', direction: 'higher' })
    expect(cell(compareGuess(answer, framework('gin', { wikipedias: 'mid' }), frameworks), 'wikipedias').direction).toBe('lower')
    expect(cell(compareGuess(answer, answer, frameworks), 'wikipedias').status).toBe('match')
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
    expect(guess.cells.map((item) => item.key)).toEqual(['model', 'query', 'acid', 'storage', 'writtenIn', 'maker', 'license', 'hosting', 'popularity', 'wikipedias', 'year'])
    expect(cell(guess, 'model').status).toBe('partial')
    expect(cell(guess, 'writtenIn').status).toBe('partial')
    expect(cell(guess, 'query').status).toBe('partial')
    expect(compareGuess(answer, answer, databases).correct).toBe(true)
  })

  it('ranks ACID transactions from none to full, with arrows', () => {
    const postgres = database('postgresql')
    expect(postgres.acid).toBe('full')
    expect(cell(compareGuess(database('redis'), postgres, databases), 'acid')).toEqual({ key: 'acid', value: 'partial', status: 'miss', direction: 'higher' })
    expect(cell(compareGuess(database('elasticsearch'), database('redis'), databases), 'acid')).toEqual({ key: 'acid', value: 'none', status: 'miss', direction: 'higher' })
    expect(cell(compareGuess(postgres, database('elasticsearch'), databases), 'acid').direction).toBe('lower')
    expect(cell(compareGuess(database('mongodb'), postgres, databases), 'acid')).toEqual({ key: 'acid', value: 'full', status: 'match' })
  })

  it('grades storage as the same or not, and the maker by family', () => {
    expect(cell(compareGuess(database('memcached'), database('redis'), databases), 'storage')).toEqual({ key: 'storage', value: 'memory', status: 'match' })
    expect(cell(compareGuess(database('postgresql'), database('redis'), databases), 'storage')).toEqual({ key: 'storage', value: 'disk', status: 'miss' })
    // Big tech and a company are both corporate: close. A foundation isn't.
    expect(cell(compareGuess(database('mysql'), database('mongodb'), databases), 'maker')).toEqual({ key: 'maker', value: 'big-tech', status: 'partial' })
    expect(cell(compareGuess(database('postgresql'), database('mongodb'), databases), 'maker').status).toBe('miss')
    expect(cell(compareGuess(database('postgresql'), database('apache-cassandra'), databases), 'maker').status).toBe('match')
  })
})

describe('classic hints', () => {
  const answer = lang('rust')
  const wrong = ['python', 'java', 'go', 'c', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'haskell', 'elixir', 'lua', 'perl'].map((id) => lang(id))
  const hints = (count, over = false, guesses = wrong) => classicHints({ answer, guesses: guesses.slice(0, count), attributes: ATTRIBUTES, wrong: count, over })

  it('unlocks a free trait at 5 wrong guesses, the first letter at 8 and the length at 12, inside the 30-guess limit', () => {
    expect(CLASSIC_HINTS_AT).toEqual([5, 8, 12])
    expect(Math.max(...CLASSIC_HINTS_AT)).toBeLessThan(MAX_GUESSES)
    expect([0, 4, 5, 7, 8, 11, 12, 13].map((count) => hints(count).map((hint) => hint.kind))).toEqual([
      [],
      [],
      ['trait'],
      ['trait'],
      ['trait', 'letter'],
      ['trait', 'letter'],
      ['trait', 'letter', 'length'],
      ['trait', 'letter', 'length'],
    ])
    expect(hints(8)[1]).toEqual({ kind: 'letter', value: 'R' })
    expect(hints(12)[2]).toEqual({ kind: 'length', value: 4 })
  })

  it('names the first column no guess before the hint matched, and keeps it as more guesses come in', () => {
    // No guess shares Rust's exact paradigms: the first column is the free one.
    expect(hints(5)[0]).toEqual({ kind: 'trait', key: 'paradigms', value: answer.paradigms })
    // Once a guess matches the paradigms, the hint moves on to the next column nobody matched.
    const lookalikes = [lang('go', { paradigms: answer.paradigms }), ...wrong]
    const free = hints(5, false, lookalikes)[0]
    const index = ATTRIBUTES.findIndex((item) => item.key === free.key)
    const matched = (column) => lookalikes.slice(0, 5).some((guess) => compareGuess(guess, answer).cells[column].status === 'match')
    expect(free).toEqual({ kind: 'trait', key: 'memory', value: 'ownership' })
    expect(matched(index)).toBe(false)
    for (let column = 0; column < index; column++) expect(matched(column), ATTRIBUTES[column].key).toBe(true)
    // Later guesses don't move it.
    expect(hints(12, false, lookalikes)[0]).toEqual(hints(5, false, lookalikes)[0])
  })

  it('gives the decade, not the year, when the year is the column left, or when every column matched', () => {
    const twin = (fields) => ({ ...answer, id: 'twin', ...fields })
    const sameButYear = [twin({ year: 2010 }), ...wrong]
    expect(hints(5, false, sameButYear)[0]).toEqual({ kind: 'decade', value: 2010 })
    expect(hints(5, false, [twin({}), ...wrong])[0]).toEqual({ kind: 'decade', value: 2010 })
  })

  it('shows every hint once the board is over, and counts the name without spaces', () => {
    expect(hints(2, true).map((hint) => hint.kind)).toEqual(['trait', 'letter', 'length'])
    const vb = classicHints({ answer: lang('vbnet'), guesses: [], attributes: ATTRIBUTES, wrong: 12, over: false })
    expect(vb.slice(1)).toEqual([
      { kind: 'letter', value: 'V' },
      { kind: 'length', value: 'VisualBasic.NET'.length },
    ])
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
