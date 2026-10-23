// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api, geminiAnswer, useTempStore } from './helpers.js'
import { QUESTION_CASE } from './store-contract-questions.js'

// A question card (from a doubt chat) trains, interrogates and reviews like an investigated case.

const AI_CHALLENGE = {
  brokenCode: 'xs = [1, 2, 3]\nfor i in range(len(xs) - 1):\n    print(xs[i])',
  symptom: 'Prints 1 and 2, but never 3.',
  hints: ['Count the lines printed.', 'Look at the range end.', 'range already stops before its end.'],
  solution: 'xs = [1, 2, 3]\nfor i in range(len(xs)):\n    print(xs[i])',
  bugExplanation: 'range leaves its end out, so - 1 skips the last item.',
}

const sent = (call = 0) => JSON.parse(fetch.mock.calls[call][1].body)
const systemOf = (call = 0) => sent(call).systemInstruction.parts[0].text
const promptOf = (call = 0) => sent(call).contents[0].parts[0].text

let store

beforeEach(async () => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
  vi.stubEnv('AI_RETRY_DELAY_MS', '0')
  vi.stubGlobal('fetch', vi.fn())
  store = await useTempStore()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('trains a question card in the gym from its topic, question and summary', async () => {
  const kase = await store.createCase('alice', QUESTION_CASE)
  fetch.mockResolvedValue(geminiAnswer(AI_CHALLENGE))
  const res = await api('/api/challenges', { body: { caseId: kase.id } })
  expect(res.status).toBe(201)
  expect((await res.json()).challenge).toMatchObject({ caseId: kase.id, language: 'python', brokenCode: AI_CHALLENGE.brokenCode })

  const prompt = promptOf()
  expect(prompt).toContain('A student asked about this topic: range end.')
  expect(prompt).toContain('It is about this kind of bug: Off by one.')
  expect(prompt).toContain(QUESTION_CASE.question)
  expect(prompt).toContain(QUESTION_CASE.analysis.explicacao)
  expect(prompt).toContain(', in python:')
  expect(prompt).not.toContain('The error they saw')
  expect((await store.getCase('alice', kase.id)).status).toBe('training')
})

it('trains a doubt with no language and no bug type in JavaScript, on the topic alone', async () => {
  const kase = await store.createCase('alice', { ...QUESTION_CASE, language: 'unknown', concept: 'other', topic: 'closures', code: '' })
  fetch.mockResolvedValue(geminiAnswer(AI_CHALLENGE))
  const { challenge } = await (await api('/api/challenges', { body: { caseId: kase.id } })).json()
  expect(challenge.language).toBe('javascript')
  expect(promptOf()).toContain('A student asked about this topic: closures.')
  expect(promptOf()).not.toContain('kind of bug: Other')
  expect(promptOf()).toContain(', in javascript:')
})

it('still trains an investigated error from its error text', async () => {
  const kase = await store.createCase('alice', { error: 'TypeError: x is undefined', code: 'x.y', analysis: QUESTION_CASE.analysis, concept: 'undefined-access', language: 'javascript' })
  fetch.mockResolvedValue(geminiAnswer(AI_CHALLENGE))
  await api('/api/challenges', { body: { caseId: kase.id } })
  expect(promptOf()).toContain('The error they saw was:\nTypeError: x is undefined')
  expect(promptOf()).not.toContain('asked about this topic')
})

it('interrogates a question card from the doubt, with steps about understanding it', async () => {
  const kase = await store.createCase('alice', QUESTION_CASE)
  fetch.mockResolvedValue(geminiAnswer({ passed: true, feedback: 'Clear doubt.', question: '' }))
  const res = await api(`/api/cases/${kase.id}/interrogation/answers`, { body: { answer: 'I do not get why the last item is skipped.' } })
  expect(res.status).toBe(200)
  expect((await res.json()).turn).toMatchObject({ step: 'reproduce', passed: true })

  expect(systemOf()).toContain('The student asked about a topic instead of bringing an error.')
  const prompt = promptOf()
  expect(prompt).toContain('THE DOUBT (the student asked this; there is no error)')
  expect(prompt).toContain('TOPIC: range end')
  expect(prompt).toContain(QUESTION_CASE.question)
  expect(prompt).toContain('Pin down the doubt')
  expect(prompt).not.toContain('ERROR:')
})

it('swaps a leaky coach reply on a question card for a safe question about the doubt', async () => {
  const kase = await store.createCase('alice', QUESTION_CASE)
  fetch.mockResolvedValue(geminiAnswer({ passed: false, feedback: 'Try:\n```py\nrange(len(xs))\n```', question: 'See?' }))
  const { turn } = await (await api(`/api/cases/${kase.id}/interrogation/answers`, { body: { answer: 'no idea' }, locale: 'pt-BR' })).json()
  expect(turn.question).toBe('O que exatamente te confunde, e onde você viu isso?')
})

it('makes the concept of a question card due for review, with cards from the pool', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T15:00:00Z'))
  await store.createCase('alice', QUESTION_CASE)
  const { review } = await (await api('/api/review?today=2026-10-22', { method: 'GET' })).json()
  expect(review.due).toEqual([{ concept: 'off-by-one', box: 1 }])
  const res = await api('/api/review/sessions', { body: { today: '2026-10-22' } })
  expect(res.status).toBe(201)
  const cards = (await store.getReviewDay('alice', '2026-10-22')).session.cards
  expect(cards).toHaveLength(1)
  expect(cards[0].concept).toBe('off-by-one')
  // Nothing in it comes from the question card's empty error.
  expect(JSON.stringify(cards[0].prompt)).not.toContain('"error":""')
})

it('pays a question card the same XP as an investigated case', async () => {
  await store.createCase('alice', QUESTION_CASE)
  const { progress } = await (await api('/api/progress?today=2026-10-22', { method: 'GET' })).json()
  expect(progress.xp).toBe(10)
  expect(progress.badges.find((badge) => badge.id === 'first-clue').earned).toBe(true)
})
