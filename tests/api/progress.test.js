// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GET } from '../../api/progress.js'
import { apiRequest, useTempStore } from './helpers.js'
import { CASE, challengeFor, PUZZLE_SECRET, puzzleFor, SECRET } from './store-contract.js'

let store

beforeEach(async () => {
  store = await useTempStore()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T15:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const earned = (progress) => progress.badges.filter((badge) => badge.earned).map((badge) => badge.id)

it('builds my progress from my cases, gym, notes and study time', async () => {
  const kase = await store.createCase('alice', CASE)
  const challenge = await store.createChallenge('alice', challengeFor(kase.id), SECRET)
  await store.updateChallenge('alice', challenge.id, { status: 'passed' })
  await store.createNote('alice', { title: 'x', blocks: [{ id: 'b1', type: 'case', caseId: kase.id }] })
  await store.addStudyTime('alice', '2026-10-21', 600, 57_600)
  await store.addStudyTime('alice', '2026-10-22', 300, 57_600)
  await store.createCase('bob', CASE)

  const res = await GET(apiRequest('/api/progress?today=2026-10-22', { method: 'GET' }))
  expect(res.status).toBe(200)
  const { progress } = await res.json()
  expect(progress).toMatchObject({ xp: 10 + 30 + 15 + 5 + 15, streak: 2, todaySeconds: 300, totalSeconds: 900 })
  expect(earned(progress)).toEqual(['first-clue', 'fixed-it', 'sharp-eye', 'note-taker'])
})

it('counts my study trail missions and the finished-trail bonus', async () => {
  await store.createCase('alice', CASE)
  const trail = await store.createTrail('alice', {
    title: 'T',
    summary: '',
    missions: [{ id: 'm1', kind: 'reflect', title: 'Think', description: 'Why?', xp: 10 }],
  })
  await store.setMissionDone('alice', trail.id, 'm1', true)
  // Bob's finished trail is not mine.
  const other = await store.createTrail('bob', { title: 'B', summary: '', missions: [{ id: 'm1', kind: 'reflect', title: 'x', description: 'x', xp: 10 }] })
  await store.setMissionDone('bob', other.id, 'm1', true)

  // case 10 + reflect mission 10 + finished trail 100
  const { progress } = await (await GET(apiRequest('/api/progress?today=2026-10-22', { method: 'GET' }))).json()
  expect(progress.xp).toBe(10 + 10 + 100)
  expect(earned(progress)).toContain('trailblazer')
})

it("falls back to the server's day when today is missing or wrong", async () => {
  await store.addStudyTime('alice', '2026-10-22', 300, 57_600)
  for (const query of ['', '?today=1999-01-01', '?today=nope']) {
    const { progress } = await (await GET(apiRequest(`/api/progress${query}`, { method: 'GET' }))).json()
    expect(progress.todaySeconds).toBe(300)
  }
})

it('asks for sign in', async () => {
  expect((await GET(apiRequest('/api/progress', { method: 'GET', token: null }))).status).toBe(401)
})

it('adds daily and global puzzles to my progress, without counting them as gym passes', async () => {
  const solvePuzzle = async (fields) => {
    const puzzle = await store.createPuzzle(puzzleFor(fields.day, fields), PUZZLE_SECRET)
    const challenge = await store.createChallenge('alice', { caseId: null, puzzleId: puzzle.id, brokenCode: 'x', symptom: 'y', language: 'python', hints: ['a', 'b', 'c'] }, PUZZLE_SECRET)
    await store.updateChallenge('alice', challenge.id, { status: 'passed', attempts: 1 })
  }
  await solvePuzzle({ day: '2026-10-21', difficulty: 'medium' })
  await solvePuzzle({ day: '2026-10-22', difficulty: 'hard' })
  await solvePuzzle({ day: '2026-10-19', kind: 'global', difficulty: 'hard' })

  const { progress } = await (await GET(apiRequest('/api/progress?today=2026-10-22', { method: 'GET' }))).json()
  expect(progress).toMatchObject({ xp: 35 + 50 + 100, dailyStreak: 2 })
  expect(earned(progress)).toEqual(['global-ace'])
})

it('adds xp and badges from my community articles', async () => {
  const article = await store.createArticle('alice', { title: 'Undefined', body: 'Check first.', tags: [], caseId: null })
  await store.setReaction(article.id, 'bob', { liked: true, rating: 'valid' })
  await store.createComment('alice', article.id, 'Thanks for reading.')
  const { progress } = await (await GET(apiRequest('/api/progress?today=2026-10-22', { method: 'GET' }))).json()
  // article 20 + like 2 + valid rating 5 + comment 2
  expect(progress.xp).toBe(29)
  expect(earned(progress)).toEqual(['author'])
})

it('adds Glitchdle xp, the lingo-master badge and a day of activity', async () => {
  for (const mode of ['classic', 'error', 'snippet']) {
    await store.saveRiddleResult('alice', { day: '2026-10-21', mode, guesses: ['go', 'rust'], solved: true }, 0)
  }
  await store.saveRiddleResult('bob', { day: '2026-10-21', mode: 'classic', guesses: ['go'], solved: true }, 0)
  const { progress } = await (await GET(apiRequest('/api/progress?today=2026-10-22', { method: 'GET' }))).json()
  expect(progress.xp).toBe(3 * 25)
  expect(earned(progress)).toEqual(['lingo-master'])
  expect(progress.activity.total).toBe(1)
  expect(progress.activity.best).toEqual({ day: '2026-10-21', count: 1 })
})

it('includes a year of activity, one count per day', async () => {
  await store.createCase('alice', CASE)
  const { progress } = await (await GET(apiRequest('/api/progress?today=2026-10-22', { method: 'GET' }))).json()
  expect(progress.activity.days).toHaveLength(53 * 7)
  expect(progress.activity.total).toBe(1)
  expect(progress.activity.best).toEqual({ day: "2026-10-22", count: 1 })
})
