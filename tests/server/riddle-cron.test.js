// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { giveawayIn } from '../../server/modules/glitchdle/clues.js'
import { answersFor, datasetPayload } from '../../server/modules/glitchdle/schedule.js'
import { languageById } from '../../shared/riddle/languages.js'
import { api, geminiAnswer, useTempStore } from './helpers.js'
import { AI_PUZZLE } from './puzzle-fixtures.js'

const SECRET = 'cron-secret-for-tests'
const runCron = (token = SECRET) => api('/api/cron/daily', { token })
const promptOf = (init) => JSON.parse(init.body).contents[0].parts[0].text
const riddlePrompts = () => fetch.mock.calls.map(([, init]) => promptOf(init)).filter((text) => text.startsWith('Glitchdle'))
const TODAY = '2026-10-22'
const TOMORROW = '2026-10-23'
const FRESH = "error: cannot find value `totl` in this scope"
const FRESH_SNIPPET = ['let total = 0', 'for item in items {', '    total += item.price', '}', 'show(total)', 'done(total)'].join('\n')

let store
let riddleAnswer

beforeEach(async () => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
  vi.stubEnv('AI_RETRY_DELAY_MS', '0')
  vi.stubEnv('CRON_SECRET', SECRET)
  vi.stubEnv('VERCEL', '')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T03:00:30Z'))
  // Puzzle prompts get a puzzle; Glitchdle prompts get whatever the test sets.
  let titles = 0
  riddleAnswer = (prompt) => (prompt.includes('snippet clue') ? { code: FRESH_SNIPPET } : { error: FRESH })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, init) =>
      promptOf(init).startsWith('Glitchdle') ? geminiAnswer(riddleAnswer(promptOf(init))) : geminiAnswer({ ...AI_PUZZLE, title: `AI puzzle ${++titles}` }),
    ),
  )
  store = await useTempStore()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('refuses a call without the cron secret and writes no riddle', async () => {
  expect((await runCron(null)).status).toBe(401)
  expect((await runCron('wrong')).status).toBe(401)
  expect(await store.listRiddles()).toEqual([])
})

it("writes today's and tomorrow's riddles, with a fresh AI error that names nothing", async () => {
  // Fresh errors are checked against the day's real answer; this one must be clean for both days.
  for (const day of [TODAY, TOMORROW]) expect(giveawayIn(FRESH, languageById(answersFor(day).error))).toBeNull()
  const body = await (await runCron()).json()
  expect(body.riddle.today).toBe(TODAY)
  expect(body.riddle.created).toHaveLength(6)
  expect(body.riddle.created.filter((item) => item.mode === 'error').map((item) => item.source)).toEqual(['ai', 'ai'])
  // The report never carries answers.
  const report = JSON.stringify(body.riddle)
  for (const day of [TODAY, TOMORROW]) for (const id of Object.values(answersFor(day))) expect(report).not.toContain(`"${id}"`)

  const today = Object.fromEntries((await store.listRiddles({ day: TODAY })).map((item) => [item.mode, item]))
  expect(today.classic.answer).toBe(answersFor(TODAY).classic)
  expect(today.error).toMatchObject({ answer: answersFor(TODAY).error, payload: { text: FRESH }, source: 'ai' })
  // Snippet mode gets fresh code too, revealed in a fixed order for the day.
  expect(today.snippet).toMatchObject({ source: 'ai', payload: { lines: FRESH_SNIPPET.split('\n') } })
  expect([...today.snippet.payload.order].sort()).toEqual([0, 1, 2, 3, 4, 5])
  expect(await store.listRiddles({ day: TOMORROW })).toHaveLength(3)
  expect(riddlePrompts()).toHaveLength(4)
  expect(riddlePrompts()[0]).toContain(languageById(answersFor(TODAY).error).name)
})

it('is idempotent: a second run adds nothing and calls no AI', async () => {
  await runCron()
  const calls = fetch.mock.calls.length
  const before = await store.listRiddles()
  const again = await (await runCron()).json()
  expect(again.riddle.created).toEqual([])
  expect(fetch.mock.calls.length).toBe(calls)
  expect(await store.listRiddles()).toEqual(before)
})

it('keeps the dataset error when the AI gives the answer away or fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  riddleAnswer = () => ({ error: `${languageById(answersFor(TODAY).error).name} says no` })
  const body = await (await runCron()).json()
  expect(body.riddle.created.filter((item) => item.mode === 'error').map((item) => item.source)).toEqual(['dataset', 'dataset'])
  const [error] = (await store.listRiddles({ day: TODAY })).filter((item) => item.mode === 'error')
  expect(error.payload).toEqual(datasetPayload(TODAY, 'error', answersFor(TODAY).error))
})

it('keeps the dataset error when the AI is down, and the puzzles still run', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  fetch.mockImplementation(async () => new Response('{}', { status: 500 }))
  const body = await (await runCron()).json()
  expect(body.riddle.created).toHaveLength(6)
  expect(body.created.length).toBeGreaterThan(0)
})

it('the day after only adds the new tomorrow', async () => {
  await runCron()
  vi.setSystemTime(new Date('2026-10-23T03:00:30Z'))
  const body = await (await runCron()).json()
  expect(body.riddle.created.map((item) => item.day)).toEqual(['2026-10-24', '2026-10-24', '2026-10-24'])
})

it('a game played before the cron keeps its riddles: the cron only fills what is missing', async () => {
  const played = await api('/api/glitchdle', { method: 'GET' })
  expect(played.status).toBe(200)
  const before = await store.listRiddles({ day: TODAY })
  const body = await (await runCron()).json()
  expect(body.riddle.created.every((item) => item.day === TOMORROW)).toBe(true)
  expect(await store.listRiddles({ day: TODAY })).toEqual(before)
})

it('keeps the dataset snippet when the AI snippet names its language', async () => {
  const name = languageById(answersFor(TODAY).snippet).name
  riddleAnswer = (prompt) =>
    prompt.includes('snippet clue') ? { code: [`// written in ${name}`, 'a = 1', 'b = 2', 'c = a + b', 'show(c)'].join('\n') } : { error: FRESH }
  await runCron()
  const [snippet] = (await store.listRiddles({ day: TODAY })).filter((item) => item.mode === 'snippet')
  expect(snippet).toMatchObject({ source: 'dataset', payload: datasetPayload(TODAY, 'snippet', answersFor(TODAY).snippet) })
})
