// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { pickFromPool } from '../../server/modules/daily/puzzle-pool.js'
import { GET, POST } from '../../api/challenge.js'
import { POST as CHECK } from '../../api/check.js'
import { POST as HINT } from '../../api/hint.js'
import { apiRequest, geminiAnswer, useTempStore } from './helpers.js'
import { PUZZLE_SECRET, puzzleFor } from './store-contract.js'

const daily = (token) => GET(apiRequest('/api/challenge?daily=1', { method: 'GET', token }))
const start = (puzzleId, token) => POST(apiRequest('/api/challenge', { body: { daily: true, puzzleId }, token }))
const read = (id, token) => GET(apiRequest(`/api/challenge?id=${id}`, { method: 'GET', token }))
const hint = (challengeId, token) => HINT(apiRequest('/api/hint', { body: { challengeId }, token }))
const check = (challengeId, code, token) => CHECK(apiRequest('/api/check', { body: { challengeId, code }, token }))

const TODAY = '2026-10-22'
let store

beforeEach(async () => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
  vi.stubEnv('AI_RETRY_DELAY_MS', '0')
  vi.stubGlobal('fetch', vi.fn())
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T15:00:00Z'))
  store = await useTempStore()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// Today's three puzzles, made by hand so tests know their secrets.
async function seedToday() {
  const made = {}
  for (const difficulty of ['easy', 'medium', 'hard']) {
    made[difficulty] = await store.createPuzzle(puzzleFor(TODAY, { difficulty, title: `Puzzle ${difficulty}` }), PUZZLE_SECRET)
  }
  return made
}

it('asks for sign in', async () => {
  expect((await daily(null)).status).toBe(401)
  expect((await start('x', null)).status).toBe(401)
})

it("fills today's set from the pool when the cron didn't run, the same for everyone", async () => {
  const res = await daily()
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body).toMatchObject({ day: TODAY, nextResetAt: '2026-10-23T03:00:00.000Z', streak: 0 })
  expect(body.puzzles.map((item) => item.difficulty)).toEqual(['easy', 'medium', 'hard'])
  for (const item of body.puzzles) {
    expect(item.title).toBe(pickFromPool({ kind: 'daily', day: TODAY, difficulty: item.difficulty }).puzzle.title)
    expect(item).toMatchObject({ status: 'new', challengeId: null, attempts: 0 })
  }
  expect(fetch).not.toHaveBeenCalled()

  const bob = await (await daily('dev:bob')).json()
  expect(bob.puzzles.map((item) => item.id)).toEqual(body.puzzles.map((item) => item.id))
  expect(await store.listPuzzles({ kind: 'daily', day: TODAY })).toHaveLength(3)
  // The week's global challenge is filled too.
  expect(await store.listPuzzles({ kind: 'global', day: '2026-10-19' })).toHaveLength(1)
})

it('only fills the slots that are missing', async () => {
  const easy = await store.createPuzzle(puzzleFor(TODAY, { title: 'Made by the AI' }), PUZZLE_SECRET)
  const body = await (await daily()).json()
  expect(body.puzzles[0]).toMatchObject({ id: easy.id, title: 'Made by the AI' })
  expect(body.puzzles).toHaveLength(3)
})

it('never sends the code, hints or solution on the cards', async () => {
  await seedToday()
  const text = await (await daily()).text()
  expect(text).not.toContain(PUZZLE_SECRET.solution)
  expect(text).not.toContain(puzzleFor(TODAY).brokenCode)
  expect(text).not.toContain(puzzleFor(TODAY).hints[0])
})

it('starts a puzzle as a gym challenge without the AI, and resumes it', async () => {
  const { medium } = await seedToday()
  const res = await start(medium.id)
  expect(res.status).toBe(201)
  const text = await res.text()
  expect(text).not.toContain(PUZZLE_SECRET.solution)
  expect(text).not.toContain(medium.hints[0])
  const { challenge } = JSON.parse(text)
  expect(challenge).toMatchObject({
    caseId: null,
    concept: 'off-by-one',
    brokenCode: medium.brokenCode,
    symptom: medium.symptom,
    language: 'python',
    hints: [],
    hintsTotal: 3,
    status: 'open',
    puzzle: { id: medium.id, kind: 'daily', difficulty: 'medium', title: 'Puzzle medium', day: TODAY },
  })

  const again = await start(medium.id)
  expect(again.status).toBe(200)
  expect((await again.json()).challenge.id).toBe(challenge.id)
  expect(fetch).not.toHaveBeenCalled()

  const card = (await (await daily()).json()).puzzles.find((item) => item.id === medium.id)
  expect(card).toMatchObject({ status: 'open', challengeId: challenge.id })
  // Bob gets his own attempt.
  expect((await (await start(medium.id, 'dev:bob')).json()).challenge.id).not.toBe(challenge.id)
})

it('refuses an unknown puzzle and one that is over', async () => {
  expect((await start('nope')).status).toBe(404)
  const old = await store.createPuzzle(puzzleFor('2026-10-20'), PUZZLE_SECRET)
  const res = await start(old.id)
  expect(res.status).toBe(409)
  expect(await res.json()).toEqual({ message: "This challenge is over. Try today's set." })
})

it("doesn't start tomorrow's puzzle early", async () => {
  const early = await store.createPuzzle(puzzleFor('2026-10-23'), PUZZLE_SECRET)
  expect((await start(early.id)).status).toBe(409)
})

it('rejects a bad request', async () => {
  const res = await POST(apiRequest('/api/challenge', { body: { daily: true, puzzleId: 42 } }))
  expect(res.status).toBe(400)
})

it('reads a puzzle challenge back with its title, for the gym', async () => {
  const { easy } = await seedToday()
  const { challenge } = await (await start(easy.id)).json()
  const res = await read(challenge.id)
  expect((await res.json()).challenge).toMatchObject({ id: challenge.id, caseId: null, concept: 'off-by-one', puzzle: { title: 'Puzzle easy' } })
  expect((await read(challenge.id, 'dev:bob')).status).toBe(404)
})

it('hands out puzzle hints one at a time, to the owner only', async () => {
  const { easy } = await seedToday()
  const { challenge } = await (await start(easy.id)).json()
  expect(await (await hint(challenge.id)).json()).toEqual({ hint: easy.hints[0], hintsRevealed: 1 })
  expect((await hint(challenge.id, 'dev:bob')).status).toBe(404)
})

it('judges a puzzle fix against the secret solution, with no case to update', async () => {
  const { hard } = await seedToday()
  const { challenge } = await (await start(hard.id)).json()
  fetch.mockResolvedValue(geminiAnswer({ passed: true, feedback: 'Every item prints now.' }))
  const res = await check(challenge.id, PUZZLE_SECRET.solution)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ passed: true, feedback: 'Every item prints now.', case: null })
  expect(JSON.parse(fetch.mock.calls[0][1].body).contents[0].parts[0].text).toContain(PUZZLE_SECRET.bugExplanation)
  expect(await store.getChallenge('alice', challenge.id)).toMatchObject({ status: 'passed', attempts: 1, passedAt: expect.any(String) })

  const body = await (await daily()).json()
  expect(body.puzzles.find((item) => item.id === hard.id)).toMatchObject({ status: 'passed', attempts: 1 })
  expect(body.streak).toBe(1)
})

it('keeps a failed puzzle fix open', async () => {
  const { easy } = await seedToday()
  const { challenge } = await (await start(easy.id)).json()
  fetch.mockResolvedValue(geminiAnswer({ passed: false, feedback: 'Still skips lamp.' }))
  expect(await (await check(challenge.id, 'print(1)')).json()).toEqual({ passed: false, feedback: 'Still skips lamp.', case: null })
  expect(await store.getChallenge('alice', challenge.id)).toMatchObject({ status: 'open', attempts: 1, passedAt: null })
})
