// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { pickFromPool } from '../../api/_lib/puzzles/pool.js'
import { GET } from '../../api/challenge.js'
import { apiRequest, geminiAnswer, useTempStore } from './helpers.js'
import { AI_PUZZLE } from './puzzle-fixtures.js'
import { PUZZLE_SECRET, puzzleFor } from './store-contract.js'

const SECRET = 'cron-secret-for-tests'
const runCron = (token = SECRET) => GET(apiRequest('/api/challenge?cron=1', { method: 'GET', token }))
const prompts = () => fetch.mock.calls.map(([, init]) => JSON.parse(init.body).contents[0].parts[0].text)
const TODAY = '2026-10-22'
const TOMORROW = '2026-10-23'

let store
let answered

beforeEach(async () => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
  vi.stubEnv('AI_RETRY_DELAY_MS', '0')
  vi.stubEnv('CRON_SECRET', SECRET)
  vi.stubEnv('VERCEL', '')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T03:00:30Z'))
  // Every AI answer gets a title of its own, like a real run.
  answered = 0
  vi.stubGlobal('fetch', vi.fn(async () => geminiAnswer({ ...AI_PUZZLE, title: `AI puzzle ${++answered}` })))
  store = await useTempStore()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('refuses a call without the cron secret', async () => {
  expect((await runCron(null)).status).toBe(401)
  expect((await runCron('dev:alice')).status).toBe(401)
  expect((await runCron('wrong-secret')).status).toBe(401)
  expect((await runCron(`${SECRET}x`)).status).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
  expect(await store.listPuzzles()).toEqual([])
})

it('only runs without a secret on a local machine', async () => {
  vi.stubEnv('CRON_SECRET', '')
  expect((await runCron(null)).status).toBe(200)
  vi.stubEnv('VERCEL', '1')
  expect((await runCron(null)).status).toBe(401)
})

it("writes today's and tomorrow's dailies plus the week's global with the AI", async () => {
  const res = await runCron()
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body.today).toBe(TODAY)
  // 3 for today, 3 for tomorrow (Friday, same week), 1 global.
  expect(body.created).toHaveLength(7)
  expect(body.created.every((item) => item.source === 'ai')).toBe(true)
  expect(JSON.stringify(body)).not.toContain(AI_PUZZLE.solution)

  const today = await store.listPuzzles({ kind: 'daily', day: TODAY })
  expect(today.map((item) => item.difficulty).sort()).toEqual(['easy', 'hard', 'medium'])
  expect(new Set(today.map((item) => item.concept)).size).toBe(3)
  expect(await store.listPuzzles({ kind: 'daily', day: TOMORROW })).toHaveLength(3)
  const [global] = await store.listPuzzles({ kind: 'global', day: '2026-10-19' })
  expect(global).toMatchObject({ kind: 'global', difficulty: 'hard' })
  expect(await store.getPuzzleSecret(global.id)).toEqual({ solution: AI_PUZZLE.solution, bugExplanation: AI_PUZZLE.bugExplanation })
  expect(prompts().some((prompt) => /two bugs/i.test(prompt))).toBe(true)
})

it('is idempotent: a second run adds nothing and calls no AI', async () => {
  await runCron()
  const calls = fetch.mock.calls.length
  const before = await store.listPuzzles()
  const again = await (await runCron()).json()
  expect(again.created).toEqual([])
  expect(fetch.mock.calls.length).toBe(calls)
  expect(await store.listPuzzles()).toEqual(before)
})

it('the next day only writes the day after, since today was made ahead', async () => {
  await runCron()
  vi.setSystemTime(new Date('2026-10-23T03:00:30Z'))
  fetch.mockClear()
  const body = await (await runCron()).json()
  expect(body.created.map((item) => item.day)).toEqual(['2026-10-24', '2026-10-24', '2026-10-24'])
  expect(fetch).toHaveBeenCalledTimes(3)
})

it("writes next week's global on the Sunday run", async () => {
  vi.setSystemTime(new Date('2026-10-25T03:00:30Z'))
  const body = await (await runCron()).json()
  expect(body.created.filter((item) => item.kind === 'global').map((item) => item.day).sort()).toEqual(['2026-10-19', '2026-10-26'])
})

it("falls back to the pool for today when the AI is down, and leaves tomorrow for the next run", async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  fetch.mockImplementation(async () => new Response('{}', { status: 500 }))
  const body = await (await runCron()).json()
  expect(body.created).toHaveLength(4)
  expect(body.created.every((item) => item.source === 'pool')).toBe(true)
  const easy = (await store.listPuzzles({ kind: 'daily', day: TODAY })).find((item) => item.difficulty === 'easy')
  expect(easy.title).toBe(pickFromPool({ kind: 'daily', day: TODAY, difficulty: 'easy' }).puzzle.title)
  expect(await store.listPuzzles({ kind: 'daily', day: TOMORROW })).toEqual([])
})

it('rejects incomplete AI puzzles', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  fetch.mockImplementation(async () => geminiAnswer({ ...AI_PUZZLE, hints: ['just one'] }))
  const body = await (await runCron()).json()
  expect(body.created.every((item) => item.source === 'pool')).toBe(true)
})

it('asks for new titles and refuses a repeat', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await store.createPuzzle(puzzleFor('2026-10-21', { title: 'Yesterday puzzle' }), PUZZLE_SECRET)
  fetch.mockImplementation(async () => geminiAnswer({ ...AI_PUZZLE, title: 'yesterday PUZZLE' }))
  const body = await (await runCron()).json()
  expect(prompts()[0]).toContain('- Yesterday puzzle')
  expect(body.created.some((item) => item.title.toLowerCase() === 'yesterday puzzle')).toBe(false)
})

it('keeps one puzzle when two AI answers share a title', async () => {
  fetch.mockImplementation(async () => geminiAnswer(AI_PUZZLE))
  const body = await (await runCron()).json()
  expect(body.created.filter((item) => item.title === AI_PUZZLE.title)).toHaveLength(1)
  // The other slots of today still get filled, from the pool.
  expect(await store.listPuzzles({ kind: 'daily', day: TODAY })).toHaveLength(3)
})
