// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api, useTempStore } from './helpers.js'
import { PUZZLE_SECRET, puzzleFor } from './store-contract.js'

const global = (token) => api('/api/daily/weekly', { method: 'GET', token })
const WEEK = '2026-10-19'

let store
let puzzle

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T15:00:00Z'))
  store = await useTempStore()
  puzzle = await store.createPuzzle(puzzleFor(WEEK, { kind: 'global', difficulty: 'hard', title: 'The big one' }), PUZZLE_SECRET)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

// Starts at `from`, passes at `to` after `attempts` tries, on the fake clock.
async function solve(userId, from, to, attempts = 1) {
  vi.setSystemTime(new Date(from))
  const challenge = await store.createChallenge(userId, { caseId: null, puzzleId: puzzle.id, brokenCode: 'x', symptom: 'y', language: 'python', hints: ['a', 'b', 'c'] }, PUZZLE_SECRET)
  vi.setSystemTime(new Date(to))
  await store.updateChallenge(userId, challenge.id, { status: 'passed', attempts })
  vi.setSystemTime(new Date('2026-10-22T15:00:00Z'))
}

const person = async (name, profile) => {
  const user = await store.createUser({ email: `${name}@secret-mail.test`, passwordHash: null, isDemo: false })
  if (profile) await store.updateProfile(user.id, profile)
  return user
}

it('asks for sign in', async () => {
  expect((await global(null)).status).toBe(401)
})

it("shows this week's global challenge, with no one on the board yet", async () => {
  const body = await (await global()).json()
  expect(body).toMatchObject({
    week: WEEK,
    endsAt: '2026-10-26T03:00:00.000Z',
    puzzle: { id: puzzle.id, kind: 'global', title: 'The big one', status: 'new', challengeId: null },
    solvedCount: 0,
    leaderboard: [],
    you: null,
  })
  expect(JSON.stringify(body)).not.toContain(PUZZLE_SECRET.solution)
})

it('falls back to the pool when the week has no global challenge yet', async () => {
  vi.setSystemTime(new Date('2026-10-27T15:00:00Z'))
  const body = await (await global()).json()
  expect(body.week).toBe('2026-10-26')
  expect(body.puzzle).toMatchObject({ kind: 'global', difficulty: 'hard', day: '2026-10-26' })
})

it("shows the week's global challenge in Portuguese to a pt-BR reader, English to the rest", async () => {
  vi.setSystemTime(new Date('2026-10-29T15:00:00Z'))
  const pt = { title: 'O próximo desafio', symptom: 'Imprime 0.', hints: ['a', 'b', 'c'] }
  const next = await store.createPuzzle({ ...puzzleFor('2026-10-26', { kind: 'global', difficulty: 'hard', title: 'The next big one' }), pt }, PUZZLE_SECRET)
  const body = await (await api('/api/daily/weekly', { method: 'GET', locale: 'pt-BR' })).json()
  expect(body.puzzle).toMatchObject({ id: next.id, title: 'O próximo desafio', symptom: 'Imprime 0.' })
  expect((await (await global()).json()).puzzle).toMatchObject({ id: next.id, title: 'The next big one' })
})

it('ranks by time from start to pass, then fewer attempts, and marks the first solver', async () => {
  const ada = await person('ada', { handle: 'ada-lab', displayName: 'Ada', isPublic: true })
  const cy = await person('cy', { handle: 'cy-dev', isPublic: true })
  const bob = await person('bob', { displayName: 'Bob Secret' })
  await solve(ada.id, '2026-10-20T09:00:00Z', '2026-10-20T09:10:00Z', 2)
  await solve(cy.id, '2026-10-20T09:05:00Z', '2026-10-20T09:15:00Z', 1)
  await solve(bob.id, '2026-10-20T09:20:00Z', '2026-10-20T09:25:00Z', 4)
  // Started but not passed: not on the board.
  await store.createChallenge('dan', { caseId: null, puzzleId: puzzle.id, brokenCode: 'x', symptom: 'y', language: 'python', hints: ['a', 'b', 'c'] }, PUZZLE_SECRET)

  const res = await global()
  const text = await res.text()
  const body = JSON.parse(text)
  expect(body.solvedCount).toBe(3)
  expect(body.leaderboard).toEqual([
    { rank: 1, name: 'Anonymous player', handle: null, avatar: null, seconds: 300, attempts: 4, firstSolver: false, isYou: false },
    { rank: 2, name: 'cy-dev', handle: 'cy-dev', avatar: expect.objectContaining({ seed: expect.any(String) }), seconds: 600, attempts: 1, firstSolver: false, isYou: false },
    { rank: 3, name: 'Ada', handle: 'ada-lab', avatar: expect.objectContaining({ seed: expect.any(String) }), seconds: 600, attempts: 2, firstSolver: true, isYou: false },
  ])
  // Private names, emails and account ids never leave the server.
  for (const secret of ['Bob Secret', 'secret-mail', ada.id, bob.id, cy.id]) expect(text).not.toContain(secret)
})

it('keeps the top 10 and tells me my own rank', async () => {
  for (let index = 0; index < 11; index++) {
    await solve(`user-${index}`, '2026-10-20T09:00:00Z', `2026-10-20T09:${String(10 + index).padStart(2, '0')}:00Z`)
  }
  await solve('alice', '2026-10-21T08:00:00Z', '2026-10-21T09:00:00Z', 3)
  const body = await (await global()).json()
  expect(body.leaderboard).toHaveLength(10)
  expect(body.leaderboard.some((entry) => entry.isYou)).toBe(false)
  expect(body.you).toEqual({ rank: 12, seconds: 3600, attempts: 3 })
  expect(body.puzzle).toMatchObject({ status: 'passed', attempts: 3 })
})

it('marks my own row on the board', async () => {
  await solve('alice', '2026-10-20T09:00:00Z', '2026-10-20T09:01:00Z')
  const body = await (await global()).json()
  expect(body.leaderboard[0]).toMatchObject({ rank: 1, isYou: true, firstSolver: true, seconds: 60 })
  expect(body.you).toEqual({ rank: 1, seconds: 60, attempts: 1 })
})
