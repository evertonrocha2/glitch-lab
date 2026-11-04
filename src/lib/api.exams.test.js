// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { answerExamQuestion, getExam, joinTrack, leaveTrack, listTopicQuestions, listTracks } from './api.js'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const call = () => {
  const [url, init] = fetch.mock.calls[0]
  return { url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers.Authorization }
}

it('loads an exam overview', async () => {
  fetch.mockResolvedValue(Response.json({ exam: { id: 'enem', areas: [] } }))
  await expect(getExam('enem', 't1')).resolves.toEqual({ id: 'enem', areas: [] })
  expect(call()).toMatchObject({ url: '/api/exams/enem', method: 'GET', auth: 'Bearer t1' })
})

it("loads a page of a topic's questions", async () => {
  const data = { topic: { id: 'funcoes' }, questions: [], page: 2, hasMore: false }
  fetch.mockResolvedValue(Response.json(data))
  await expect(listTopicQuestions({ examId: 'enem', topicId: 'funcoes', page: 2 }, 't1')).resolves.toEqual(data)
  expect(call().url).toBe('/api/exams/enem/topics/funcoes/questions?page=2')
})

it('answers a question', async () => {
  const data = { attempt: { choice: 'B', correct: true, answer: 'B' }, first: true }
  fetch.mockResolvedValue(Response.json(data))
  await expect(answerExamQuestion('q1', 'B', 't1')).resolves.toEqual(data)
  expect(call()).toMatchObject({ url: '/api/exam-questions/q1/answer', method: 'POST', body: { choice: 'B' } })
})

it('lists, joins and leaves tracks', async () => {
  fetch.mockResolvedValueOnce(Response.json({ tracks: [{ id: 'enem' }] }))
  await expect(listTracks('t1')).resolves.toEqual([{ id: 'enem' }])
  expect(call()).toMatchObject({ url: '/api/tracks', method: 'GET' })

  fetch.mockClear()
  fetch.mockResolvedValueOnce(Response.json({ track: { id: 'enem', examDate: '2027-11-07' } }))
  await expect(joinTrack('enem', { examDate: '2027-11-07' }, 't1')).resolves.toEqual({ id: 'enem', examDate: '2027-11-07' })
  expect(call()).toMatchObject({ url: '/api/tracks/enem', method: 'PUT', body: { examDate: '2027-11-07' } })

  fetch.mockClear()
  fetch.mockResolvedValueOnce(Response.json({ deleted: true }))
  await leaveTrack('enem', 't1')
  expect(call()).toMatchObject({ url: '/api/tracks/enem', method: 'DELETE' })
})
