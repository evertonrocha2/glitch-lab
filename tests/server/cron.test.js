// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { pickFromPool } from '../../server/modules/daily/puzzle-pool.js'
import { api, geminiAnswer, useTempStore } from './helpers.js'
import { AI_PUZZLE, AI_PUZZLE_PT, AI_SECRET_PT } from './puzzle-fixtures.js'
import { PUZZLE_SECRET, puzzleFor } from './store-contract.js'

const SECRET = 'cron-secret-for-tests'
const runCron = (token = SECRET) => api('/api/cron/daily', { token })
// The old URL, kept for one release so a cron still calling it keeps working.
const runOldCron = (token = SECRET) => api('/api/challenge?cron=1', { method: 'GET', token })
// The same run also asks for Line hunt snippets (see hunt-cron.test.js); these tests read the rest.
const prompts = () => fetch.mock.calls.map(([, init]) => JSON.parse(init.body).contents[0].parts[0].text).filter((text) => !text.startsWith('Line hunt'))
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

it('still answers on the old URL, with the same secret check', async () => {
  expect((await runOldCron(null)).status).toBe(401)
  expect(await (await runOldCron('wrong-secret')).json()).toEqual({ message: 'Not allowed.' })
  expect(await store.listPuzzles()).toEqual([])
  const res = await runOldCron()
  expect(res.status).toBe(200)
  expect((await res.json()).created).toHaveLength(7)
})

it('answers 404 on the old URL without ?cron', async () => {
  const res = await api('/api/challenge', { method: 'GET', token: SECRET })
  expect(res.status).toBe(404)
  expect(await res.json()).toEqual({ message: 'Not found.' })
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
  expect(await store.getPuzzleSecret(global.id)).toEqual({ solution: AI_PUZZLE.solution, bugExplanation: AI_PUZZLE.bugExplanation, pt: AI_SECRET_PT })
  // Shared by everyone, so saved in both languages with one copy of the code.
  expect(global.pt).toEqual(AI_PUZZLE_PT)
  expect(today.every((item) => item.pt?.title === AI_PUZZLE.titlePt)).toBe(true)
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
  // Three puzzles; the same run also asks for one Glitchdle error clue (see riddle-cron.test.js).
  expect(prompts().filter((prompt) => !prompt.startsWith('Glitchdle'))).toHaveLength(3)
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
