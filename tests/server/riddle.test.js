// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { answersFor, datasetPayload } from '../../server/modules/glitchdle/schedule.js'
import { MAX_GUESSES } from '../../shared/riddle/game.js'
import { LANGUAGES } from '../../shared/riddle/languages.js'
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

// A language that isn't the answer of `mode`, different for each `skip`.
const wrongFor = (mode, skip = 0) => LANGUAGES.filter((item) => item.id !== answers[mode])[skip].id
const json = async (res) => ({ status: res.status, body: await res.json() })

it('asks for sign in', async () => {
  expect((await state(null)).status).toBe(401)
  expect((await guess('classic', 'go', null)).status).toBe(401)
})

it("serves today's game without any answer, the same set for everyone", async () => {
  const { status, body } = await json(await state())
  expect(status).toBe(200)
  expect(body).toMatchObject({ day: TODAY, number: 1, nextResetAt: '2026-10-23T03:00:00.000Z' })
  expect(Object.keys(body.modes)).toEqual(['classic', 'error', 'snippet'])
  for (const mode of ['classic', 'error', 'snippet']) {
    expect(body.modes[mode]).toMatchObject({ mode, solved: false, over: false, guessCount: 0, guessesLeft: MAX_GUESSES, answer: null, guesses: [] })
  }
  // Nothing in the answer names today's languages.
  const text = JSON.stringify(body)
  for (const id of Object.values(answers)) expect(text).not.toContain(`"${id}"`)
  expect(body.modes.error.text).toBe(datasetPayload(TODAY, 'error', answers.error).text)
  expect(body.modes.error.hints).toEqual([])
  expect(body.modes.error.nextHintIn).toBe(3)
  expect(fetch).not.toHaveBeenCalled()

  const saved = await store.listRiddles({ day: TODAY })
  expect(saved.map((item) => item.mode).sort()).toEqual(['classic', 'error', 'snippet'])
  const bob = await json(await state('dev:bob'))
  expect(bob.body.modes).toEqual(body.modes)
  expect(await store.listRiddles({ day: TODAY })).toHaveLength(3)
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
    expect(classic.guesses[0].cells).toHaveLength(8)
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
    expect(body.stats).toMatchObject({ xp: 25, played: 1, solved: { classic: 1, error: 0, snippet: 0 } })
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
    })
  })
})

it('keeps a streak of perfect days', async () => {
  for (const mode of ['classic', 'error', 'snippet']) await guess(mode, answers[mode])
  const { body } = await json(await state())
  expect(body.stats).toMatchObject({ perfectDays: 1, streak: 1, longestStreak: 1, played: 1, xp: 75 })
})
