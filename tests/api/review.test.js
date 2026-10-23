// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { pickFromPool, POOL } from '../../api/_lib/puzzles/pool.js'
import { GET, POST } from '../../api/progress.js'
import { REVIEW_XP, REVIEW_XP_CARDS_PER_DAY } from '../../shared/review.js'
import { apiRequest, useTempStore } from './helpers.js'
import { CASE, challengeFor, SECRET } from './store-contract.js'

let store
const TODAY = '2026-10-22'

beforeEach(async () => {
  store = await useTempStore()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${TODAY}T15:00:00Z`))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const overview = async (today = TODAY, token) => (await GET(apiRequest(`/api/progress?review=1&today=${today}`, { method: 'GET', token }))).json()
const start = (today = TODAY, token) => POST(apiRequest('/api/progress?review=start', { body: { today }, token }))
const answer = (fields, today = TODAY) => POST(apiRequest('/api/progress?review=answer', { body: { today, ...fields } }))
// The stored session holds the answers; the API never sends them before a card is answered.
const secretCards = async (today = TODAY) => (await store.getReviewDay('alice', today)).session.cards
const progressOf = async (today = TODAY) => (await (await GET(apiRequest(`/api/progress?today=${today}`, { method: 'GET' }))).json()).progress

it('needs a session', async () => {
  expect((await start(TODAY, null)).status).toBe(401)
  expect((await GET(apiRequest('/api/progress?review=1', { method: 'GET', token: null }))).status).toBe(401)
})

it('has nothing due before any case, and says so', async () => {
  const { review } = await overview()
  expect(review).toMatchObject({ today: TODAY, met: 0, due: [], nextDueDay: null, session: null, day: { cards: 0, right: 0, completed: false, xp: 0 } })
  expect(review.xpCap).toBe(REVIEW_XP_CARDS_PER_DAY * REVIEW_XP.card)
  const res = await start()
  expect(res.status).toBe(409)
  expect((await res.json()).message).toBe('Nothing to review right now.')
})

it('opens a session for the concepts met, hiding the answers, and resumes it', async () => {
  await store.createCase('alice', CASE)
  await store.createCase('alice', { ...CASE, concept: 'off-by-one', error: 'IndexError: list index out of range' })
  await store.createCase('alice', { ...CASE, concept: 'other' })
  await store.createCase('bob', { ...CASE, concept: 'key-error' })

  const { review } = await overview()
  expect(review.due.map((item) => item.concept).sort()).toEqual(['off-by-one', 'undefined-access'])

  const res = await start()
  expect(res.status).toBe(201)
  const { session } = await res.json()
  expect(session.cards).toHaveLength(2)
  expect(session).toMatchObject({ answers: [], right: 0, done: false })
  const text = JSON.stringify(session)
  expect(text).not.toContain('"answer"')
  expect(text).not.toContain('"explanation"')
  // First review of a concept: "what causes this?" from my own error message.
  expect(session.cards.every((card) => card.type === 'cause' && card.concept === null)).toBe(true)
  expect(session.cards.map((card) => card.prompt.error)).toContain('IndexError: list index out of range')

  const again = await start()
  expect(again.status).toBe(200)
  expect((await again.json()).session.id).toBe(session.id)
  expect((await overview()).review.session.id).toBe(session.id)
})

it('grades each card, moves the box, tallies XP and finishes the day', async () => {
  await store.createCase('alice', CASE)
  await store.createCase('alice', { ...CASE, concept: 'off-by-one' })
  const { session } = await (await start()).json()
  const cards = await secretCards()

  const wrongChoice = cards[0].options.find((option) => option.id !== cards[0].answer).id
  const first = await answer({ sessionId: session.id, index: 0, choice: wrongChoice })
  expect(first.status).toBe(200)
  const graded = await first.json()
  expect(graded.result).toMatchObject({ index: 0, choice: wrongChoice, correct: false, answer: cards[0].answer, concept: cards[0].concept })
  expect(graded.item).toEqual({ concept: cards[0].concept, box: 1, dueDay: '2026-10-23' })
  expect(graded).toMatchObject({ xp: 0, session: { done: false, right: 0 }, day: { cards: 1, right: 0, completed: false } })

  // A second answer to the same card changes nothing.
  const twice = await (await answer({ sessionId: session.id, index: 0, choice: cards[0].answer })).json()
  expect(twice.result.correct).toBe(false)
  expect(twice.day.cards).toBe(1)

  const second = await (await answer({ sessionId: session.id, index: 1, choice: cards[1].answer })).json()
  expect(second).toMatchObject({ xp: REVIEW_XP.card, result: { correct: true }, item: { box: 2, dueDay: '2026-10-25' } })
  expect(second.session).toMatchObject({ done: true, right: 1 })
  expect(second.day).toEqual({ cards: 2, right: 1, completed: true, xp: REVIEW_XP.card })

  const items = await store.listReviewItems('alice')
  expect(items.map((item) => [item.concept, item.box]).sort()).toEqual(
    [
      [cards[0].concept, 1],
      [cards[1].concept, 2],
    ].sort(),
  )
  // Nothing left today: the overview says when the next one is due.
  const { review } = await overview()
  expect(review).toMatchObject({ due: [], session: null, nextDueDay: '2026-10-23', day: { completed: true } })
  expect((await start()).status).toBe(409)

  // Tomorrow the missed concept is back.
  vi.setSystemTime(new Date('2026-10-23T15:00:00Z'))
  expect((await overview('2026-10-23')).review.due.map((item) => item.concept)).toEqual([cards[0].concept])

  // The day counts in progress: XP, and once on the activity graph.
  const progress = await progressOf('2026-10-23')
  expect(progress.activity.days.reduce((sum, count) => sum + count, 0)).toBe(2 + 1)
  expect(progress.skills.concepts.find((item) => item.concept === cards[1].concept)).toMatchObject({ met: true, box: 2 })
  expect(progress.skills.weakest).toBe(cards[0].concept)
})

it('builds "which line?" and "pick the fix" cards from my own gym challenge', async () => {
  const kase = await store.createCase('alice', CASE)
  const challenge = await store.createChallenge('alice', challengeFor(kase.id), { ...SECRET, solution: 'const a = {}\nconsole.log(a.b?.c)' })
  await store.updateChallenge('alice', challenge.id, { status: 'passed' })
  // Reviewed once already: the next card is a "which line?" one.
  await store.saveReviewItem('alice', { concept: 'undefined-access', box: 2, dueDay: TODAY, lastDay: '2026-10-19', right: 1, wrong: 0 })

  const { session } = await (await start()).json()
  expect(session.cards).toHaveLength(1)
  expect(session.cards[0]).toMatchObject({ type: 'line', concept: 'undefined-access', prompt: { lines: ['const a = {}', 'console.log(a.b.c)'] } })
  const [card] = await secretCards()
  expect(card.answer).toBe('l2')
  const { result } = await (await answer({ sessionId: session.id, index: 0, choice: 'l2' })).json()
  expect(result).toMatchObject({ correct: true, fixed: 'console.log(a.b?.c)', explanation: SECRET.bugExplanation })
})

it('gives a Portuguese reader the pool explanation and symptom in Portuguese', async () => {
  // A daily puzzle from the pool, passed: the day saved its English text.
  const { puzzle, secret } = pickFromPool({ kind: 'daily', day: TODAY, difficulty: 'easy' })
  const saved = await store.createPuzzle(puzzle, secret)
  const challenge = await store.createChallenge('alice', { caseId: null, puzzleId: saved.id, brokenCode: puzzle.brokenCode, symptom: puzzle.symptom, language: puzzle.language, hints: puzzle.hints }, secret)
  await store.updateChallenge('alice', challenge.id, { status: 'passed' })
  // Reviewed once: a "which line?" card, built from that puzzle.
  await store.saveReviewItem('alice', { concept: puzzle.concept, box: 2, dueDay: TODAY, lastDay: '2026-10-19', right: 1, wrong: 0 })
  const entry = POOL.find((item) => item.title === puzzle.title)

  const res = await POST(apiRequest('/api/progress?review=start', { body: { today: TODAY }, locale: 'pt-BR,pt;q=0.9' }))
  const { session } = await res.json()
  expect(session.cards[0]).toMatchObject({ type: 'line', prompt: { symptom: entry.pt?.symptom ?? entry.symptom } })
  const [card] = await secretCards()
  const { result } = await (await answer({ sessionId: session.id, index: 0, choice: card.answer })).json()
  expect(result.explanation).toBe(entry.pt.bugExplanation)
  expect(result.explanation).not.toBe(secret.bugExplanation)
})

it('keeps the pool explanation in English for an English reader', async () => {
  await store.createCase('alice', { ...CASE, concept: 'off-by-one' })
  await store.saveReviewItem('alice', { concept: 'off-by-one', box: 2, dueDay: TODAY, lastDay: '2026-10-19', right: 1, wrong: 0 })
  const { session } = await (await POST(apiRequest('/api/progress?review=start', { body: { today: TODAY }, locale: 'en-US' }))).json()
  expect(session.cards[0].type).toBe('line')
  const [card] = await secretCards()
  const { result } = await (await answer({ sessionId: session.id, index: 0, choice: card.answer })).json()
  expect(result.explanation).toBe(POOL.find((item) => item.concept === 'off-by-one').bugExplanation)
})

it('rejects bad answers and stale sessions', async () => {
  await store.createCase('alice', CASE)
  const { session } = await (await start()).json()
  expect((await answer({ sessionId: session.id, index: 0, choice: 'z' })).status).toBe(400)
  expect((await answer({ sessionId: session.id, index: 7, choice: 'a' })).status).toBe(400)
  expect((await answer({ sessionId: session.id, index: '0', choice: 'a' })).status).toBe(400)
  const stale = await answer({ sessionId: 'old', index: 0, choice: 'a' })
  expect(stale.status).toBe(409)
  expect((await stale.json()).message).toBe("This review is over. Open today's review again.")
  expect((await POST(apiRequest('/api/progress?review=nope', { body: {} }))).status).toBe(400)
})

it('stops paying XP after the daily cap and gives the badge after 7 finished days', async () => {
  for (let index = 0; index < 7; index++) {
    await store.saveReviewDay('alice', `2026-10-1${index}`, { session: null, cards: 12, right: 12, completed: true }, 0)
  }
  const progress = await progressOf()
  expect(progress.xp).toBe(7 * REVIEW_XP_CARDS_PER_DAY * REVIEW_XP.card)
  expect(progress.badges.find((badge) => badge.id === 'elephant-memory').earned).toBe(true)
})

it('keeps the study timer working on the same endpoint', async () => {
  const res = await POST(apiRequest('/api/progress', { body: { seconds: 60, day: TODAY } }))
  expect(res.status).toBe(200)
  expect((await res.json()).todaySeconds).toBe(60)
})
