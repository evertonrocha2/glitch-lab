// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { buildSet } from '../../server/modules/hunt/hunt-daily.js'
import { GET, POST } from '../../api/challenge.js'
import { ANSWER_GRACE_MS, BASE_POINTS, HUNT_ROUNDS, ROUND_MS, SPEED_POINTS } from '../../shared/hunt/game.js'
import { HUNT_POOL } from '../../shared/hunt/snippets.js'
import { apiRequest, useTempStore } from './helpers.js'

const TODAY = '2026-10-22'
const START = new Date('2026-10-22T15:00:00Z').getTime()
const json = async (pending) => {
  const res = await pending
  return { status: res.status, body: await res.json() }
}
const view = (token, locale) => json(GET(apiRequest('/api/challenge?hunt=1', { method: 'GET', token, locale })))
const act = (body, token, locale) => json(POST(apiRequest('/api/challenge', { body: { ...body }, token, locale })))
const start = (token) => act({ hunt: 'start' }, token)
const answer = (index, line, token, extra = {}) => act({ hunt: 'answer', index, line, ...extra }, token)
const next = (token) => act({ hunt: 'next' }, token)
const at = (ms) => vi.setSystemTime(new Date(START + ms))

let store
// Today's set, worked out the same way the server does (from the pool, since no cron ran).
let set

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn())
  vi.useFakeTimers({ toFake: ['Date'] })
  at(0)
  store = await useTempStore()
  set = buildSet(TODAY).snippets
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// A line that isn't the answer of round `index`.
const wrongLine = (index) => (set[index].line === 1 ? 2 : 1)

// Plays a whole run: round i answered right after `ms[i]` milliseconds (null: a wrong line).
async function playRun(token, timings) {
  let clock = 0
  at(clock)
  await start(token)
  for (let index = 0; index < HUNT_ROUNDS; index++) {
    if (index > 0) {
      clock += 5000
      at(clock)
      await next(token)
    }
    const ms = timings[index] ?? 1000
    clock += ms
    at(clock)
    await answer(index, timings[index] === null ? wrongLine(index) : set[index].line, token)
  }
}

it('asks for sign in', async () => {
  expect((await view(null)).status).toBe(401)
  expect((await start(null)).status).toBe(401)
})

it("serves today's state with no run yet, the same set for everyone, written once", async () => {
  const { status, body } = await view()
  expect(status).toBe(200)
  expect(body).toMatchObject({ day: TODAY, rounds: HUNT_ROUNDS, roundMs: ROUND_MS, run: null, players: 0, leaderboard: [], you: null, nextResetAt: '2026-10-23T03:00:00.000Z' })
  const saved = await store.getHuntDay(TODAY)
  expect(saved.snippets).toHaveLength(HUNT_ROUNDS)
  expect(saved.source).toBe('pool')
  await view('dev:bob')
  expect((await store.getHuntDay(TODAY)).snippets).toEqual(saved.snippets)
  expect(fetch).not.toHaveBeenCalled()
})

it('starts the run with the first snippet, timed by the server, and never sends its line', async () => {
  const { status, body } = await start()
  expect(status).toBe(200)
  const { current } = body.run
  expect(current).toEqual({ index: 0, language: set[0].language, symptom: set[0].symptom.en, code: set[0].code, remainingMs: ROUND_MS })
  expect(body.run).toMatchObject({ finished: false, score: 0, correct: 0, results: [], nextIndex: null })
  // Nothing in the answer holds the line, the explanation or the bug type.
  const text = JSON.stringify(body)
  expect(text).not.toContain(set[0].explanation.en)
  expect(text).not.toContain('"answer"')
  expect(text).not.toContain('"line"')
  // A reload a few seconds later keeps the same round with less time left.
  at(6000)
  expect((await view()).body.run.current).toMatchObject({ index: 0, remainingMs: ROUND_MS - 6000 })
  // A second start is the same run, not a new one.
  expect((await start()).body.run.current).toMatchObject({ index: 0, remainingMs: ROUND_MS - 6000 })
  expect(await store.listHuntRuns('alice')).toHaveLength(1)
})

it('grades an answer with the time the server measured, then reveals the line, the explanation and the bug type', async () => {
  await start()
  at(5000)
  const { status, body } = await answer(0, set[0].line)
  expect(status).toBe(200)
  expect(body.result).toMatchObject({ index: 0, correct: true, timedOut: false, picked: set[0].line, answer: set[0].line, concept: set[0].concept, ms: 5000 })
  expect(body.result.explanation).toBe(set[0].explanation.en)
  expect(body.result.points).toBe(BASE_POINTS + Math.round((SPEED_POINTS * 15) / 20))
  expect(body.run).toMatchObject({ score: body.result.points, correct: 1, current: null, nextIndex: 1 })
  // Answering the same round again is refused.
  expect((await answer(0, set[0].line)).status).toBe(409)
})

it('reads the explanation and the symptom in Portuguese', async () => {
  await act({ hunt: 'start' }, undefined, 'pt-BR')
  const { body } = await act({ hunt: 'answer', index: 0, line: set[0].line }, undefined, 'pt-BR')
  expect(body.result.explanation).toBe(set[0].explanation.pt)
  expect(body.result.symptom).toBe(set[0].symptom.pt)
})

it('scores a wrong line zero and a late answer as a timeout, even when the line is right', async () => {
  await start()
  at(3000)
  const wrong = await answer(0, wrongLine(0))
  expect(wrong.body.result).toMatchObject({ correct: false, timedOut: false, points: 0, answer: set[0].line })

  at(10_000)
  await next()
  // Inside the grace time: still counts, with the base points only.
  at(10_000 + ROUND_MS + ANSWER_GRACE_MS - 100)
  expect((await answer(1, set[1].line)).body.result).toMatchObject({ correct: true, points: BASE_POINTS, ms: ROUND_MS })

  at(60_000)
  await next()
  at(60_000 + ROUND_MS + ANSWER_GRACE_MS - 1)
  // A null line means the player's own timer ran out.
  expect((await answer(2, null)).body.result).toMatchObject({ correct: false, timedOut: true, points: 0 })
})

it('settles a round nobody answered as a timeout, then refuses that late answer', async () => {
  await start()
  at(ROUND_MS + ANSWER_GRACE_MS + 1)
  expect((await answer(0, set[0].line)).status).toBe(409)
  const { body } = await view()
  expect(body.run.results[0]).toMatchObject({ correct: false, timedOut: true, points: 0, picked: null, answer: set[0].line })
  expect(body.run).toMatchObject({ current: null, nextIndex: 1 })
})

it('validates the line and the round', async () => {
  expect((await answer(0, 1)).status).toBe(409)
  await start()
  expect((await answer(0, 0)).status).toBe(400)
  expect((await answer(0, 999)).status).toBe(400)
  expect((await answer(0, '2')).status).toBe(400)
  expect((await answer(3, 1)).status).toBe(409)
  expect((await act({ hunt: 'dance' })).status).toBe(400)
  expect((await answer(0, 1, 'dev:alice', { day: '2026-10-21' })).status).toBe(409)
})

it('serves the next snippet only when asked, and only once', async () => {
  await start()
  at(2000)
  await answer(0, set[0].line)
  at(30_000)
  const first = await next()
  expect(first.body.run.current).toMatchObject({ index: 1, remainingMs: ROUND_MS, code: set[1].code })
  at(31_000)
  expect((await next()).body.run.current).toMatchObject({ index: 1, remainingMs: ROUND_MS - 1000 })
})

it('finishes after 8 snippets, ranks the run and refuses another one', async () => {
  await playRun('dev:alice', [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000])
  const { body } = await view()
  expect(body.run).toMatchObject({ finished: true, correct: HUNT_ROUNDS, xp: 50, current: null, nextIndex: null })
  expect(body.run.results).toHaveLength(HUNT_ROUNDS)
  expect(body.you).toMatchObject({ rank: 1, correct: HUNT_ROUNDS, score: body.run.score })
  expect(body.leaderboard[0]).toMatchObject({ rank: 1, isYou: true, name: 'Anonymous detective', correct: HUNT_ROUNDS })
  expect((await next()).status).toBe(409)
  expect((await start()).body.run.finished).toBe(true)
})

it('keeps demo accounts off the leaderboard, ranks by points, and shows my place', async () => {
  await playRun('dev:bob', [2000, 2000, null, 2000, 2000, 2000, 2000, 2000])
  await playRun('dev:alice', [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000])
  // The local store learns who is a demo from its users list.
  const demo = await store.createUser({ email: 'demo-1@demo.glitch', passwordHash: null, isDemo: true })
  const demoToken = (await import('./helpers.js')).sessionFor(demo.id)
  await playRun(demoToken, [500, 500, 500, 500, 500, 500, 500, 500])

  const { body } = await view('dev:bob')
  expect(body.players).toBe(2)
  expect(body.leaderboard.map((entry) => entry.correct)).toEqual([8, 7])
  expect(body.you).toMatchObject({ rank: 2, correct: 7 })
  expect((await view(demoToken)).body.you).toBeNull()
})

it('counts the run in progress: XP, the eagle-eye badge and the activity graph', async () => {
  await playRun('dev:alice', [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000])
  const progress = await (await import('../../api/progress.js')).GET(apiRequest(`/api/progress?today=${TODAY}`, { method: 'GET' }))
  const { progress: data } = await progress.json()
  expect(data.xp).toBeGreaterThanOrEqual(50)
  expect(data.badges.find((badge) => badge.id === 'eagle-eye')).toEqual({ id: 'eagle-eye', earned: true })
  expect(data.activity.days.at(-1 - (6 - new Date(`${TODAY}T00:00:00Z`).getUTCDay()))).toBeGreaterThanOrEqual(1)
})

it('serves practice snippets from the pool, never one of today, and grades them without saving', async () => {
  const todayIds = new Set(set.map((item) => item.id))
  for (let index = 0; index < 20; index++) {
    const { status, body } = await json(GET(apiRequest('/api/challenge?hunt=practice', { method: 'GET' })))
    expect(status).toBe(200)
    expect(todayIds.has(body.snippet.id)).toBe(false)
    expect(body.snippet).not.toHaveProperty('line')
    expect(body.snippet).not.toHaveProperty('explanation')
  }
  const free = HUNT_POOL.find((item) => !todayIds.has(item.id))
  const { body } = await act({ hunt: 'practice', id: free.id, line: free.line })
  expect(body.result).toMatchObject({ correct: true, answer: free.line, concept: free.concept, explanation: free.explanation.en, points: 0 })
  expect(await store.listHuntRuns('alice')).toEqual([])
  // Today's snippets can't be graded as practice.
  expect((await act({ hunt: 'practice', id: set[0].id, line: 1 })).status).toBe(404)
  expect((await act({ hunt: 'practice', id: 'nope', line: 1 })).status).toBe(404)
  expect((await act({ hunt: 'practice', id: free.id, line: 0 })).status).toBe(400)
})

it('skips the snippet just played when asking for the next practice one', async () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0)
  const first = (await json(GET(apiRequest('/api/challenge?hunt=practice', { method: 'GET' })))).body.snippet.id
  const second = (await json(GET(apiRequest(`/api/challenge?hunt=practice&after=${first}`, { method: 'GET' })))).body.snippet.id
  expect(second).not.toBe(first)
  random.mockRestore()
})
