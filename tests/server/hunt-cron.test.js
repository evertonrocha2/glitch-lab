// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AI_PER_DAY, buildSet, parseAiSnippets } from '../../server/modules/hunt/hunt-daily.js'
import { HUNT_ROUNDS } from '../../shared/hunt/game.js'
import { HUNT_POOL } from '../../shared/hunt/snippets.js'
import { api, geminiAnswer, useTempStore } from './helpers.js'
import { AI_PUZZLE } from './puzzle-fixtures.js'

const SECRET = 'cron-secret-for-tests'
const runCron = () => api('/api/cron/daily', { token: SECRET })
const promptOf = (init) => JSON.parse(init.body).contents[0].parts[0].text
const huntPrompts = () => fetch.mock.calls.map(([, init]) => promptOf(init)).filter((text) => text.startsWith('Line hunt'))
const TODAY = '2026-10-22'
const TOMORROW = '2026-10-23'

// A fresh AI snippet; `n` makes each one's code different.
const aiSnippet = (n, overrides = {}) => ({
  language: 'python',
  concept: 'off-by-one',
  code: ['def total(items):', '    result = 0', `    for i in range(1, len(items)):  # pass ${n}`, '        result += items[i]', '    return result', '', 'print(total([5, 1, 2]))'].join('\n'),
  line: 3,
  symptomEn: 'Prints 3 instead of 8.',
  symptomPt: 'Imprime 3 em vez de 8.',
  explanationEn: 'The range starts at 1 — so the first item is skipped.',
  explanationPt: 'O range começa em 1, então o primeiro item é pulado.',
  ...overrides,
})

let store
let huntAnswer

beforeEach(async () => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
  vi.stubEnv('AI_RETRY_DELAY_MS', '0')
  vi.stubEnv('CRON_SECRET', SECRET)
  vi.stubEnv('VERCEL', '')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T03:00:30Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // Line hunt prompts get what the test sets; puzzles and the Glitchdle get a puzzle (they fall back).
  let titles = 0
  huntAnswer = () => ({ snippets: [aiSnippet(1), aiSnippet(2), aiSnippet(3)] })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, init) => (promptOf(init).startsWith('Line hunt') ? geminiAnswer(huntAnswer()) : geminiAnswer({ ...AI_PUZZLE, title: `AI puzzle ${++titles}` }))),
  )
  store = await useTempStore()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it("writes today's and tomorrow's runs with fresh AI snippets mixed into the pool, and reports no answers", async () => {
  const body = await (await runCron()).json()
  expect(body.hunt).toEqual({ today: TODAY, created: [{ day: TODAY, source: 'ai', fresh: 3 }, { day: TOMORROW, source: 'ai', fresh: 3 }] })
  for (const day of [TODAY, TOMORROW]) {
    const set = await store.getHuntDay(day)
    expect(set.snippets).toHaveLength(HUNT_ROUNDS)
    const fresh = set.snippets.filter((item) => item.source === 'ai')
    expect(fresh).toHaveLength(AI_PER_DAY)
    expect(fresh[0]).toMatchObject({ language: 'python', concept: 'off-by-one', line: 3, symptom: { en: 'Prints 3 instead of 8.' } })
    // No em dashes reach the app.
    expect(fresh[0].explanation.en).toBe('The range starts at 1, so the first item is skipped.')
    expect(set.snippets.filter((item) => item.source === 'pool')).toHaveLength(HUNT_ROUNDS - AI_PER_DAY)
  }
  expect(huntPrompts()).toHaveLength(2)
  expect(huntPrompts()[0]).toContain('6 to 15 lines')
})

it('is idempotent: a second run writes nothing and asks the AI for nothing', async () => {
  await runCron()
  const asked = huntPrompts().length
  const before = await store.getHuntDay(TODAY)
  const again = await (await runCron()).json()
  expect(again.hunt.created).toEqual([])
  expect(huntPrompts()).toHaveLength(asked)
  expect(await store.getHuntDay(TODAY)).toEqual(before)
})

it('drops AI snippets that fail the check and fills their places from the pool', async () => {
  huntAnswer = () => ({
    snippets: [
      aiSnippet(1, { line: 42 }),
      aiSnippet(2, { explanationPt: '  ' }),
      // The same code as a pool snippet.
      aiSnippet(3, { code: HUNT_POOL[0].code.join('\n'), line: HUNT_POOL[0].line, language: HUNT_POOL[0].language }),
      aiSnippet(4),
      // The same code twice in one answer: only the first counts.
      aiSnippet(4),
    ],
  })
  await runCron()
  const set = await store.getHuntDay(TODAY)
  expect(set.snippets).toHaveLength(HUNT_ROUNDS)
  expect(set.snippets.filter((item) => item.source === 'ai').map((item) => item.code[2])).toEqual(['    for i in range(1, len(items)):  # pass 4'])
})

it("falls back to the pool for today when the AI is down, and leaves tomorrow for the next run", async () => {
  fetch.mockImplementation(async () => new Response('{}', { status: 500 }))
  const body = await (await runCron()).json()
  expect(body.hunt.created).toEqual([{ day: TODAY, source: 'pool', fresh: 0 }])
  expect((await store.getHuntDay(TODAY)).snippets).toEqual(buildSet(TODAY).snippets)
  expect(await store.getHuntDay(TOMORROW)).toBeNull()
})

it('keeps the snippets a check refuses out of the parsed list', () => {
  expect(parseAiSnippets({ snippets: [aiSnippet(1, { language: 'cobol' })] }, TODAY)).toEqual([])
  expect(parseAiSnippets(null, TODAY)).toEqual([])
  expect(parseAiSnippets({ snippets: [aiSnippet(1)] }, TODAY)[0]).toMatchObject({ id: `ai-${TODAY}-1`, source: 'ai' })
})
