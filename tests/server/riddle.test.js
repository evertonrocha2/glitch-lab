// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { answersFor, datasetPayload } from '../../server/modules/glitchdle/schedule.js'
import { categoryById } from '../../shared/riddle/categories.js'
import { MAX_GUESSES, RIDDLE_DAY_XP_CAP } from '../../shared/riddle/game.js'
import { ATTRIBUTES, LANGUAGES } from '../../shared/riddle/languages.js'
import { api, useTempStore } from './helpers.js'

const TODAY = '2026-10-22'
const state = (token) => api('/api/glitchdle', { method: 'GET', token })
const guess = (mode, id, token, extra = {}) => api('/api/glitchdle/guesses', { body: { mode, guess: id, ...extra }, token })

let store
let answers

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T15:00:00Z'))
  store = await useTempStore()
  answers = answersFor(TODAY)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// An item that isn't the answer of `mode`, different for each `skip`.
const ITEMS = { frameworks: categoryById('frameworks').items, databases: categoryById('databases').items }
const wrongFor = (mode, skip = 0) => (ITEMS[mode] ?? LANGUAGES).filter((item) => item.id !== answers[mode])[skip].id
const json = async (res) => ({ status: res.status, body: await res.json() })

it('asks for sign in', async () => {
  expect((await state(null)).status).toBe(401)
  expect((await guess('classic', 'go', null)).status).toBe(401)
})

it("serves today's game without any answer, the same set for everyone", async () => {
  const { status, body } = await json(await state())
  expect(status).toBe(200)
  expect(body).toMatchObject({ day: TODAY, number: 1, nextResetAt: '2026-10-23T03:00:00.000Z' })
  expect(Object.keys(body.modes)).toEqual(['classic', 'error', 'snippet', 'frameworks', 'databases'])
  for (const mode of Object.keys(body.modes)) {
    expect(body.modes[mode]).toMatchObject({ mode, solved: false, over: false, guessCount: 0, guessesLeft: MAX_GUESSES, answer: null, guesses: [] })
  }
  expect(body.modes.frameworks.category).toBe('frameworks')
  expect(body.modes.classic.category).toBe('languages')
  // Nothing in the answer names today's languages.
  const text = JSON.stringify(body)
  for (const id of Object.values(answers)) expect(text).not.toContain(`"${id}"`)
  expect(body.modes.error.text).toBe(datasetPayload(TODAY, 'error', answers.error).text)
  expect(body.modes.error.hints).toEqual([])
  expect(body.modes.error.nextHintIn).toBe(3)
  expect(fetch).not.toHaveBeenCalled()

  const saved = await store.listRiddles({ day: TODAY })
  expect(saved.map((item) => item.mode).sort()).toEqual(['classic', 'databases', 'error', 'frameworks', 'snippet'])
  const bob = await json(await state('dev:bob'))
  expect(bob.body.modes).toEqual(body.modes)
  expect(await store.listRiddles({ day: TODAY })).toHaveLength(5)
})

it('hides all but one line of the snippet, keeping only the lengths of the rest', async () => {
  const { body } = await json(await state())
  const { lines } = datasetPayload(TODAY, 'snippet', answers.snippet)
  const shown = body.modes.snippet.lines
  expect(shown).toHaveLength(lines.length)
  const visible = shown.filter((line) => !line.hidden && line.text.trim() !== '')
  expect(visible).toHaveLength(1)
  for (const [index, line] of shown.entries()) {
    if (line.hidden) expect(line).toEqual({ hidden: true, width: lines[index].length })
    else expect(line.text).toBe(lines[index])
  }
})

describe('guessing', () => {
  it('grades a wrong Classic guess, saves it, and still hides the answer', async () => {
    const wrong = wrongFor('classic')
    const { status, body } = await json(await guess('classic', wrong))
    expect(status).toBe(200)
    expect(body.correct).toBe(false)
    const classic = body.modes.classic
    expect(classic).toMatchObject({ solved: false, over: false, guessCount: 1, guessesLeft: MAX_GUESSES - 1, answer: null })
    expect(classic.guesses).toHaveLength(1)
    expect(classic.guesses[0]).toMatchObject({ id: wrong, correct: false })
    expect(classic.guesses[0].cells).toHaveLength(ATTRIBUTES.length)
    expect(JSON.stringify(body.modes)).not.toContain(`"${answers.classic}"`)

    // A reload keeps the board.
    const again = await json(await state())
    expect(again.body.modes.classic.guesses).toEqual(classic.guesses)
  })

  it('wins with the right language and reveals it, newest guess first', async () => {
    await guess('classic', wrongFor('classic'))
    const { body } = await json(await guess('classic', answers.classic))
    expect(body.correct).toBe(true)
    expect(body.modes.classic).toMatchObject({ solved: true, over: true, guessCount: 2, answer: { id: answers.classic } })
    expect(body.modes.classic.guesses.map((item) => item.id)).toEqual([answers.classic, wrongFor('classic')])
    expect(body.modes.classic.guesses[0].cells.every((item) => item.status === 'match')).toBe(true)
    // The other modes keep their secrets.
    expect(body.modes.error.answer).toBeNull()
    expect(body.stats).toMatchObject({ xp: 25, played: 1, solved: { classic: 1, error: 0, snippet: 0, frameworks: 0, databases: 0 } })
    expect(body.stats.distribution.classic[1]).toBe(1)
  })

  it('validates mode, language and repeats', async () => {
    expect((await json(await guess('quiz', 'go'))).status).toBe(400)
    expect((await json(await guess('classic', 'brainfudge'))).status).toBe(400)
    expect((await json(await guess('classic', 42))).status).toBe(400)
    const wrong = wrongFor('classic')
    await guess('classic', wrong)
    const repeat = await json(await guess('classic', wrong))
    expect(repeat.status).toBe(409)
    expect(repeat.body.message).toMatch(/already tried/)
    expect((await store.getRiddleResult('alice', TODAY, 'classic')).guesses).toEqual([wrong])
  })

  it('refuses guesses after solving', async () => {
    await guess('error', answers.error)
    const after = await json(await guess('error', wrongFor('error')))
    expect(after.status).toBe(409)
    expect(after.body.message).toMatch(/already solved/)
  })

  it('refuses a guess sent from yesterday', async () => {
    const res = await json(await guess('classic', wrongFor('classic'), 'dev:alice', { day: '2026-10-21' }))
    expect(res.status).toBe(409)
    expect(await store.getRiddleResult('alice', TODAY, 'classic')).toBeNull()
    expect((await guess('classic', wrongFor('classic'), 'dev:alice', { day: TODAY })).status).toBe(200)
  })

  it('ends a mode after the last guess and shows the answer', async () => {
    for (let index = 0; index < MAX_GUESSES; index++) expect((await guess('snippet', wrongFor('snippet', index))).status).toBe(200)
    const { body } = await json(await state())
    expect(body.modes.snippet).toMatchObject({ solved: false, over: true, guessesLeft: 0, answer: { id: answers.snippet } })
    expect(body.modes.snippet.lines.every((line) => !line.hidden)).toBe(true)
    const more = await json(await guess('snippet', wrongFor('snippet', MAX_GUESSES)))
    expect(more.status).toBe(409)
    expect(more.body.message).toMatch(/No guesses left/)
  })

  it('unlocks Error hints after 3 and 6 wrong guesses', async () => {
    for (let index = 0; index < 3; index++) await guess('error', wrongFor('error', index))
    let mode = (await json(await state())).body.modes.error
    expect(mode.hints.map((hint) => hint.label)).toEqual(['File extension'])
    expect(mode.nextHintIn).toBe(3)
    for (let index = 3; index < 6; index++) await guess('error', wrongFor('error', index))
    mode = (await json(await state())).body.modes.error
    expect(mode.hints.map((hint) => hint.label)).toEqual(['File extension', 'Syntax family'])
    expect(mode.nextHintIn).toBeNull()
    expect(mode.answer).toBeNull()
  })

  it('unlocks classic hints after 5, 8 and 12 wrong guesses, never sending a locked one', async () => {
    const answer = LANGUAGES.find((item) => item.id === answers.classic)
    const steps = { 4: [], 5: ['trait'], 7: ['trait'], 8: ['trait', 'letter'], 11: ['trait', 'letter'], 12: ['trait', 'letter', 'length'] }
    const next = { 4: 1, 5: 3, 7: 1, 8: 4, 11: 1, 12: null }
    for (let count = 1; count <= 12; count++) {
      await guess('classic', wrongFor('classic', count - 1))
      if (!steps[count]) continue
      const { body } = await json(await state())
      const board = body.modes.classic
      expect(board.hints.map((hint) => hint.kind).sort(), `${count} wrong`).toEqual([...steps[count]].sort())
      expect(board.nextHintIn, `${count} wrong`).toBe(next[count])
      // Nothing beyond the unlocked hints leaves the server, under any name.
      const text = JSON.stringify(body.modes.classic)
      if (count < 8) expect(text).not.toContain('"letter"')
      if (count < 12) expect(text).not.toContain('"length"')
      expect(board.answer).toBeNull()
    }
    const { body } = await json(await state())
    const [free, letter, length] = body.modes.classic.hints
    expect(letter).toEqual({ kind: 'letter', value: answer.name.charAt(0) })
    expect(length).toEqual({ kind: 'length', value: answer.name.replace(/\s/g, '').length })
    if (free.kind === 'trait') {
      expect(free.value).toEqual(answer[free.key])
      // None of the first five guesses had it right.
      const firstFive = (await store.getRiddleResult('alice', TODAY, 'classic')).guesses.slice(0, 5)
      expect(firstFive.map((id) => LANGUAGES.find((item) => item.id === id)[free.key])).not.toContainEqual(answer[free.key])
    } else {
      expect(free).toEqual({ kind: 'decade', value: Math.floor(answer.year / 10) * 10 })
    }
    // The other boards still have none.
    expect(body.modes.frameworks.hints).toEqual([])
    expect(body.modes.frameworks.nextHintIn).toBe(5)
  })

  it('gives framework and database boards the same hints', async () => {
    for (let index = 0; index < 8; index++) await guess('databases', wrongFor('databases', index))
    const { body } = await json(await state())
    const answer = ITEMS.databases.find((item) => item.id === answers.databases)
    expect(body.modes.databases.hints.map((hint) => hint.kind)).toEqual([expect.stringMatching(/^(trait|decade)$/), 'letter'])
    expect(body.modes.databases.hints[1].value).toBe(answer.name.charAt(0))
    expect(body.modes.databases.nextHintIn).toBe(4)
  })

  it('shows one more snippet line per wrong guess', async () => {
    const visible = (body) => body.modes.snippet.lines.filter((line) => !line.hidden && line.text.trim() !== '').length
    expect(visible((await json(await state())).body)).toBe(1)
    await guess('snippet', wrongFor('snippet', 0))
    await guess('snippet', wrongFor('snippet', 1))
    expect(visible((await json(await state())).body)).toBe(3)
  })
})

describe('community numbers', () => {
  it("counts today's players per mode, leaving demo accounts out", async () => {
    await guess('classic', wrongFor('classic'), 'dev:alice')
    await guess('classic', answers.classic, 'dev:alice')
    await guess('classic', answers.classic, 'dev:bob')
    await guess('error', wrongFor('error'), 'dev:carol')
    const demo = await store.createUser({ email: 'demo-x@demo.glitch', passwordHash: null, isDemo: true })
    await store.saveRiddleResult(demo.id, { day: TODAY, mode: 'classic', guesses: [answers.classic], solved: true }, 0)

    const { body } = await json(await state())
    expect(body.community).toEqual({
      classic: { players: 2, solved: 2, averageGuesses: 1.5 },
      error: { players: 1, solved: 0, averageGuesses: null },
      snippet: { players: 0, solved: 0, averageGuesses: null },
      frameworks: { players: 0, solved: 0, averageGuesses: null },
      databases: { players: 0, solved: 0, averageGuesses: null },
    })
  })
})

it('keeps a streak of perfect days', async () => {
  for (const mode of ['classic', 'error', 'snippet']) await guess(mode, answers[mode])
  const { body } = await json(await state())
  expect(body.stats).toMatchObject({ perfectDays: 1, streak: 1, longestStreak: 1, played: 1, xp: 75 })
})

describe('frameworks and databases', () => {
  it('grades a framework guess trait by trait and keeps the answer hidden', async () => {
    const wrong = wrongFor('frameworks')
    const { status, body } = await json(await guess('frameworks', wrong))
    expect(status).toBe(200)
    expect(body.correct).toBe(false)
    const board = body.modes.frameworks
    expect(board).toMatchObject({ category: 'frameworks', solved: false, guessCount: 1, answer: null })
    expect(board.guesses[0].cells.map((cell) => cell.key)).toEqual(['language', 'runtime', 'typing', 'area', 'kind', 'maker', 'license', 'popularity', 'wikipedias', 'year'])
    expect(JSON.stringify(body.modes)).not.toContain(`"${answers.frameworks}"`)
    expect((await store.getRiddleResult('alice', TODAY, 'frameworks')).guesses).toEqual([wrong])
  })

  it('solves a database board and reveals it, every other board still secret', async () => {
    const { body } = await json(await guess('databases', answers.databases))
    expect(body.correct).toBe(true)
    expect(body.modes.databases).toMatchObject({ solved: true, over: true, answer: { id: answers.databases } })
    expect(body.modes.databases.guesses[0].cells.every((cell) => cell.status === 'match')).toBe(true)
    expect(body.modes.frameworks.answer).toBeNull()
    expect(body.stats.solved.databases).toBe(1)
    expect(body.stats.xp).toBe(25)
  })

  it("only takes items from the board's own list", async () => {
    const language = await json(await guess('frameworks', 'python'))
    expect(language.status).toBe(400)
    expect(language.body.message).toBe('Pick a framework from the list.')
    expect((await json(await guess('databases', wrongFor('frameworks')))).body.message).toBe('Pick a database from the list.')
    const wrong = wrongFor('databases')
    await guess('databases', wrong)
    expect((await json(await guess('databases', wrong))).body.message).toBe('You already tried that one.')
  })

  it('counts a full day when every board is solved, with the day XP capped', async () => {
    for (const mode of Object.keys(answers)) await guess(mode, answers[mode])
    const { body } = await json(await state())
    expect(body.stats).toMatchObject({ perfectDays: 1, fullDays: 1, streak: 1, xp: RIDDLE_DAY_XP_CAP })
  })

  it('still serves the language boards when a category board cannot be saved', async () => {
    const create = store.createRiddle.bind(store)
    store.createRiddle = async (item) => {
      if (item.mode === 'frameworks') throw new Error('violates check constraint')
      return create(item)
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { status, body } = await json(await state())
    expect(status).toBe(200)
    expect(Object.keys(body.modes)).toEqual(['classic', 'error', 'snippet', 'databases'])
    expect((await json(await guess('frameworks', wrongFor('frameworks')))).status).toBe(409)
    expect((await json(await guess('classic', wrongFor('classic')))).status).toBe(200)
  })
})
