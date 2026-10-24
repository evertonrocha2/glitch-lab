// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DAILY_AI_LIMIT } from '../../server/infra/ai/quota.js'
import { STRIKE_LIMIT, strikeKey } from '../../server/infra/ai/guard/index.js'
import { api, geminiAnswer, useTempStore } from './helpers.js'
import { AI_PORT } from './puzzle-fixtures.js'
import { PUZZLE_SECRET, puzzleFor } from './store-contract.js'

// Each player may switch a daily or global puzzle to another programming language, once.
const switchTo = (puzzleId, language, { token, locale } = {}) => api(`/api/daily/puzzles/${encodeURIComponent(puzzleId)}/switch`, { body: { language }, token, locale })
const start = (puzzleId, token) => api(`/api/daily/puzzles/${encodeURIComponent(puzzleId)}/challenge`, { token })
const read = (id, { token, locale } = {}) => api(`/api/challenges/${encodeURIComponent(id)}`, { method: 'GET', token, locale })
const hint = (id, { token, locale } = {}) => api(`/api/challenges/${encodeURIComponent(id)}/hints`, { token, locale })
const check = (id, code, token) => api(`/api/challenges/${encodeURIComponent(id)}/check`, { body: { code }, token })
const daily = ({ token, locale } = {}) => api('/api/daily', { method: 'GET', token, locale })
const weekly = (token) => api('/api/daily/weekly', { method: 'GET', token })

const TODAY = '2026-10-22'
const WEEK = '2026-10-19'
const FAILED = "Couldn't make this challenge in JavaScript right now. Your switch is still unused, so you can try again later."
let store
let puzzle

beforeEach(async () => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
  vi.stubEnv('AI_RETRY_DELAY_MS', '0')
  vi.stubGlobal('fetch', vi.fn())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T15:00:00Z'))
  store = await useTempStore()
  // Today's easy puzzle, in Python, with its Portuguese copy.
  puzzle = await store.createPuzzle(
    { ...puzzleFor(TODAY, { title: 'Easy one' }), pt: { title: 'Fácil', symptom: 'Imprime 1 e 2.', hints: ['Conte.', 'Olhe o range.', 'Para antes.'] } },
    PUZZLE_SECRET,
  )
  for (const difficulty of ['medium', 'hard']) await store.createPuzzle(puzzleFor(TODAY, { difficulty }), PUZZLE_SECRET)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const sentPrompt = (call = 0) => JSON.parse(fetch.mock.calls[call][1].body)
const cardOf = async (opts) => (await (await daily(opts)).json()).puzzles.find((item) => item.id === puzzle.id)

it('asks for sign in', async () => {
  expect((await switchTo(puzzle.id, 'javascript', { token: null })).status).toBe(401)
})

it('switches a puzzle before it starts: the card and the new challenge are in the new language', async () => {
  expect(await cardOf()).toMatchObject({ language: 'python', switchedFrom: null, canSwitch: true })
  fetch.mockResolvedValue(geminiAnswer(AI_PORT))

  const res = await switchTo(puzzle.id, 'javascript')
  expect(res.status).toBe(200)
  const text = await res.text()
  expect(JSON.parse(text)).toEqual({
    puzzle: expect.objectContaining({ id: puzzle.id, title: 'Easy one', language: 'javascript', symptom: AI_PORT.symptom, status: 'new', switchedFrom: 'python', canSwitch: false }),
    challenge: null,
    switchedFrom: 'python',
  })
  // The port's secret and hints never reach the browser.
  for (const secret of [AI_PORT.solution, AI_PORT.bugExplanation, AI_PORT.hints[0], AI_PORT.brokenCode]) expect(text).not.toContain(secret)
  expect(fetch).toHaveBeenCalledTimes(1)

  // The original puzzle went to the AI as fenced data, under the guard rules.
  const sent = sentPrompt()
  expect(sent.contents[0].parts[0].text).toMatch(/<<<DATA original_code GLB-[0-9a-f]{16}>>>\nitems = \[1, 2, 3\]/)
  expect(sent.systemInstruction.parts[0].text).toContain('Scope and safety')

  expect(await cardOf()).toMatchObject({ language: 'javascript', switchedFrom: 'python', canSwitch: false, symptom: AI_PORT.symptom })
  expect(await cardOf({ locale: 'pt-BR' })).toMatchObject({ title: 'Fácil', symptom: AI_PORT.symptomPt })

  const { challenge } = await (await start(puzzle.id)).json()
  expect(challenge).toMatchObject({ brokenCode: AI_PORT.brokenCode, language: 'javascript', symptom: AI_PORT.symptom, hints: [], puzzle: { title: 'Easy one', switchedFrom: 'python', canSwitch: false } })
  // The fix is judged against the port's solution.
  fetch.mockResolvedValue(geminiAnswer({ off_topic: false, passed: true, feedback: 'Every item prints now.' }))
  expect((await (await check(challenge.id, AI_PORT.solution)).json()).passed).toBe(true)
  expect(sentPrompt(1).contents[0].parts[0].text).toContain(AI_PORT.bugExplanation)
})

it('switches only once per puzzle', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_PORT))
  expect((await switchTo(puzzle.id, 'javascript')).status).toBe(200)
  for (const language of ['javascript', 'go']) {
    const again = await switchTo(puzzle.id, language)
    expect(again.status).toBe(409)
    expect(await again.json()).toEqual({ message: 'You already switched the language of this challenge.' })
  }
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(await store.findPuzzleSwitch('alice', puzzle.id)).toMatchObject({ fromLanguage: 'python', toLanguage: 'javascript' })
})

it('reuses a saved port: a second player switching to the same language makes no AI call and spends no quota', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_PORT))
  await switchTo(puzzle.id, 'javascript')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(await store.countUsage('alice', TODAY)).toBe(1)

  const res = await switchTo(puzzle.id, 'javascript', { token: 'dev:bob' })
  expect(res.status).toBe(200)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(await store.countUsage('bob', TODAY)).toBe(0)
  const { challenge } = await (await start(puzzle.id, 'dev:bob')).json()
  expect(challenge.brokenCode).toBe(AI_PORT.brokenCode)
})

it('moves an open challenge: code resets, hints revealed and attempts carry over, the gym shows the switch', async () => {
  const { challenge } = await (await start(puzzle.id)).json()
  await hint(challenge.id)
  await hint(challenge.id)
  fetch.mockResolvedValueOnce(geminiAnswer({ off_topic: false, passed: false, feedback: 'Still skips the last one.' }))
  await check(challenge.id, 'print(1)')
  expect((await (await read(challenge.id)).json()).challenge.puzzle).toMatchObject({ switchedFrom: null, canSwitch: true })

  fetch.mockResolvedValueOnce(geminiAnswer(AI_PORT))
  const body = await (await switchTo(puzzle.id, 'javascript')).json()
  expect(body.switchedFrom).toBe('python')
  expect(body.puzzle).toMatchObject({ status: 'open', challengeId: challenge.id, attempts: 1, language: 'javascript' })
  expect(body.challenge).toMatchObject({
    id: challenge.id,
    brokenCode: AI_PORT.brokenCode,
    language: 'javascript',
    symptom: AI_PORT.symptom,
    // The same number of hints, in the new language: switching never hands out fresh ones.
    hints: AI_PORT.hints.slice(0, 2),
    hintsRevealed: 2,
    hintsTotal: 3,
    attempts: 1,
    status: 'open',
    puzzle: { id: puzzle.id, title: 'Easy one', switchedFrom: 'python', canSwitch: false },
  })
  expect(JSON.stringify(body)).not.toContain(AI_PORT.hints[2])
  expect(JSON.stringify(body)).not.toContain(AI_PORT.solution)

  // The gym reads it back the same way, in either language, and the next hint is the port's third.
  expect((await (await read(challenge.id)).json()).challenge).toMatchObject({ brokenCode: AI_PORT.brokenCode, hints: AI_PORT.hints.slice(0, 2) })
  expect((await (await read(challenge.id, { locale: 'pt-BR' })).json()).challenge).toMatchObject({ symptom: AI_PORT.symptomPt, hints: AI_PORT.hintsPt.slice(0, 2), puzzle: { title: 'Fácil' } })
  expect(await (await hint(challenge.id, { locale: 'pt-BR' })).json()).toEqual({ hint: AI_PORT.hintsPt[2], hintsRevealed: 3 })
  expect(await store.getChallengeSecret(challenge.id)).toEqual({ solution: AI_PORT.solution, bugExplanation: AI_PORT.bugExplanation })
})

it('keeps the leaderboard clock from the first start and shows who switched', async () => {
  const global = await store.createPuzzle(puzzleFor(WEEK, { kind: 'global', difficulty: 'hard', title: 'The big one' }), PUZZLE_SECRET)
  const alice = await store.createUser({ email: 'alice@lab.test', passwordHash: null, isDemo: false })
  const bob = await store.createUser({ email: 'bob@lab.test', passwordHash: null, isDemo: false })
  const token = (user) => `dev:${user.id}`

  vi.setSystemTime(new Date('2026-10-20T09:00:00Z'))
  const { challenge } = await (await start(global.id, token(alice))).json()
  vi.setSystemTime(new Date('2026-10-20T09:04:00Z'))
  fetch.mockResolvedValueOnce(geminiAnswer(AI_PORT))
  expect((await switchTo(global.id, 'javascript', { token: token(alice) })).status).toBe(200)
  vi.setSystemTime(new Date('2026-10-20T09:10:00Z'))
  fetch.mockResolvedValueOnce(geminiAnswer({ off_topic: false, passed: true, feedback: 'Fixed.' }))
  expect((await (await check(challenge.id, AI_PORT.solution, token(alice))).json()).passed).toBe(true)

  vi.setSystemTime(new Date('2026-10-20T10:00:00Z'))
  const bobs = (await (await start(global.id, token(bob))).json()).challenge
  vi.setSystemTime(new Date('2026-10-20T10:20:00Z'))
  fetch.mockResolvedValueOnce(geminiAnswer({ off_topic: false, passed: true, feedback: 'Fixed.' }))
  await check(bobs.id, PUZZLE_SECRET.solution, token(bob))

  vi.setSystemTime(new Date('2026-10-22T15:00:00Z'))
  const body = await (await weekly(token(alice))).json()
  expect(body.leaderboard.map((row) => [row.seconds, row.switchedTo, row.isYou])).toEqual([
    [600, 'javascript', true],
    [1200, null, false],
  ])
  expect(body.puzzle).toMatchObject({ status: 'passed', language: 'javascript', switchedFrom: 'python', canSwitch: false })
})

it('refuses a port that changes the kind of bug, after one retry, and leaves the switch unused', async () => {
  fetch.mockResolvedValue(geminiAnswer({ ...AI_PORT, concept: 'key-error' }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const res = await switchTo(puzzle.id, 'javascript')
  expect(res.status).toBe(502)
  expect(await res.json()).toEqual({ message: FAILED })
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(await store.findPuzzleSwitch('alice', puzzle.id)).toBeNull()
  expect(await store.getPuzzleVariant(puzzle.id, 'javascript')).toBeNull()
  expect(await cardOf()).toMatchObject({ canSwitch: true, language: 'python' })

  // Later, a good port goes through.
  fetch.mockResolvedValue(geminiAnswer(AI_PORT))
  expect((await switchTo(puzzle.id, 'javascript')).status).toBe(200)
})

it('says why a switch is refused', async () => {
  const expectError = async (res, status, message) => {
    expect(res.status).toBe(status)
    expect(await res.json()).toEqual({ message })
  }
  await expectError(await switchTo(puzzle.id, 'cobol'), 400, 'Pick one of the languages on the list.')
  await expectError(await api(`/api/daily/puzzles/${puzzle.id}/switch`, { body: {} }), 400, 'Pick one of the languages on the list.')
  await expectError(await switchTo(puzzle.id, 'python'), 400, 'This challenge is already in that language.')
  await expectError(await switchTo(crypto.randomUUID(), 'go'), 404, 'Challenge not found.')
  const old = await store.createPuzzle(puzzleFor('2026-10-20'), PUZZLE_SECRET)
  await expectError(await switchTo(old.id, 'go'), 409, "This challenge is over. Try today's set.")

  const { challenge } = await (await start(puzzle.id)).json()
  await store.updateChallenge('alice', challenge.id, { status: 'passed', attempts: 1 })
  await expectError(await switchTo(puzzle.id, 'go'), 409, "You already solved this challenge, so its language can't change.")
  expect(await cardOf()).toMatchObject({ canSwitch: false })
  expect(fetch).not.toHaveBeenCalled()
})

it('counts the AI call on the daily limit and goes through the guard lockout', async () => {
  for (let i = 0; i < DAILY_AI_LIMIT.user; i++) await store.addUsage('alice', TODAY)
  const limited = await switchTo(puzzle.id, 'javascript')
  expect(limited.status).toBe(429)
  expect(await limited.json()).toEqual({ message: 'Daily limit reached. Come back tomorrow.' })

  for (let i = 0; i < STRIKE_LIMIT; i++) await store.addUsage(strikeKey('bob'), TODAY)
  expect((await switchTo(puzzle.id, 'javascript', { token: 'dev:bob' })).status).toBe(429)
  expect(fetch).not.toHaveBeenCalled()
  expect(await store.findPuzzleSwitch('alice', puzzle.id)).toBeNull()

  // A port already saved costs nothing, even past the limit.
  await store.createPuzzleVariant(puzzle.id, 'go', { brokenCode: 'x', symptom: 'y', hints: ['a', 'b', 'c'] }, { solution: 'z', bugExplanation: 'w' })
  expect((await switchTo(puzzle.id, 'go')).status).toBe(200)
})

it('answers in Portuguese for the reader, and translates nothing in the code', async () => {
  fetch.mockResolvedValue(geminiAnswer(AI_PORT))
  const body = await (await switchTo(puzzle.id, 'javascript', { locale: 'pt-BR' })).json()
  expect(body.puzzle).toMatchObject({ title: 'Fácil', symptom: AI_PORT.symptomPt })
})
