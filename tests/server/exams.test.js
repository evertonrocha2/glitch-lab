// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api, useTempStore } from './helpers.js'
import { examQuestion } from './store-contract-exams.js'

let store
let funcoes
let estatistica

beforeEach(async () => {
  store = await useTempStore()
  await store.upsertExamQuestions([
    examQuestion('enem', { number: 1, topic: 'funcoes', answer: 'B' }),
    examQuestion('enem', { number: 2, topic: 'funcoes', answer: 'D' }),
    examQuestion('enem', { number: 3, topic: 'estatistica' }),
    examQuestion('enem', { number: 4, topic: 'funcoes', needsReview: true }),
  ])
  funcoes = await store.listExamQuestions('enem', 'funcoes', { offset: 0, limit: 10 })
  ;[estatistica] = await store.listExamQuestions('enem', 'estatistica', { offset: 0, limit: 10 })
})
afterEach(() => vi.unstubAllEnvs())

const get = (url, token) => api(url, { method: 'GET', token })
const answer = (id, choice, token) => api(`/api/exam-questions/${id}/answer`, { body: choice === undefined ? {} : { choice }, token })
const topicOf = (exam, id) => exam.areas.flatMap((area) => area.topics).find((topic) => topic.id === id)

it('shows the exam with question counts and my stats', async () => {
  await answer(funcoes[0].id, 'B')
  const { exam } = await (await get('/api/exams/enem')).json()
  expect(exam).toMatchObject({ id: 'enem', name: 'ENEM', joined: false, examDate: null })
  expect(exam.areas.map((area) => area.id)).toEqual(['linguagens', 'humanas', 'natureza', 'matematica'])
  expect(exam.areas[3]).toMatchObject({ shortName: 'Matemática', name: 'Matemática e suas Tecnologias' })
  expect(topicOf(exam, 'funcoes')).toEqual({ id: 'funcoes', name: 'Funções', questions: 2, answered: 1, correct: 1 })
  expect(topicOf(exam, 'estatistica')).toMatchObject({ questions: 1, answered: 0, correct: 0 })
  expect(topicOf(exam, 'geometria-plana')).toMatchObject({ questions: 0, answered: 0, correct: 0 })

  await api('/api/tracks/enem', { method: 'PUT', body: { examDate: null } })
  expect((await (await get('/api/exams/enem')).json()).exam.joined).toBe(true)
})

it("lists a topic's questions without leaking answers", async () => {
  const res = await get('/api/exams/enem/topics/funcoes/questions')
  expect(res.status).toBe(200)
  const text = await res.text()
  expect(text).not.toContain('"answer"')
  expect(text).not.toContain('isCorrect')
  expect(text).not.toContain('needsReview')
  expect(text).not.toContain('sourceKey')
  const body = JSON.parse(text)
  expect(body).toMatchObject({ topic: { id: 'funcoes', name: 'Funções', area: 'matematica' }, page: 1, hasMore: false })
  expect(body.questions.map((item) => item.number)).toEqual([1, 2])
  expect(body.questions[0]).toEqual({
    id: funcoes[0].id,
    year: 2023,
    number: 1,
    area: 'matematica',
    topic: 'funcoes',
    context: funcoes[0].context,
    statement: funcoes[0].statement,
    alternatives: funcoes[0].alternatives,
    attempt: null,
  })
})

it('shows my answer once I answered, to me only', async () => {
  const res = await answer(funcoes[0].id, 'C')
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ attempt: { choice: 'C', correct: false, answer: 'B' }, first: true })
  const mine = (await (await get('/api/exams/enem/topics/funcoes/questions')).json()).questions
  expect(mine[0].attempt).toEqual({ choice: 'C', correct: false, answer: 'B' })
  expect(mine[1].attempt).toBeNull()
  const bobs = (await (await get('/api/exams/enem/topics/funcoes/questions', 'dev:bob')).json()).questions
  expect(bobs[0].attempt).toBeNull()
})

it('keeps the first answer', async () => {
  await answer(funcoes[0].id, 'C')
  const again = await answer(funcoes[0].id, 'B')
  expect(again.status).toBe(200)
  expect(await again.json()).toEqual({ attempt: { choice: 'C', correct: false, answer: 'B' }, first: false })
  const { exam } = await (await get('/api/exams/enem')).json()
  expect(topicOf(exam, 'funcoes')).toMatchObject({ answered: 1, correct: 0 })
})

it('pages a topic', async () => {
  await store.upsertExamQuestions(Array.from({ length: 12 }, (_, index) => examQuestion('enem', { year: 2020, number: index + 1, topic: 'trigonometria' })))
  const first = await (await get('/api/exams/enem/topics/trigonometria/questions')).json()
  expect(first.questions).toHaveLength(10)
  expect(first).toMatchObject({ page: 1, hasMore: true })
  const second = await (await get('/api/exams/enem/topics/trigonometria/questions?page=2')).json()
  expect(second.questions).toHaveLength(2)
  expect(second).toMatchObject({ page: 2, hasMore: false })
})

it('refuses odd choices', async () => {
  for (const choice of ['F', 'b', 1, null, undefined]) {
    const res = await answer(estatistica.id, choice)
    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe('Pick one of the alternatives.')
  }
})

it('refuses questions, exams and topics that are not there', async () => {
  for (const id of ['00000000-0000-4000-8000-000000000000', 'nope']) {
    const res = await answer(id, 'A')
    expect(res.status).toBe(404)
    expect((await res.json()).message).toBe('Question not found.')
  }
  const exam = await get('/api/exams/esa')
  expect(exam.status).toBe(404)
  expect((await exam.json()).message).toBe('Exam not found.')
  const topic = await get('/api/exams/enem/topics/nope/questions')
  expect(topic.status).toBe(404)
  expect((await topic.json()).message).toBe('Topic not found.')
  expect((await get('/api/exams/esa/topics/funcoes/questions')).status).toBe(404)
})

it('refuses to answer a question in review', async () => {
  const [hidden] = await store.listUntaggedExamQuestions('enem', 10)
  expect(hidden).toBeUndefined()
  const data = JSON.parse(await readFile(process.env.LOCAL_STORE_FILE, 'utf8'))
  const res = await answer(data.examQuestions.find((item) => item.needsReview).id, 'A')
  expect(res.status).toBe(404)
  expect((await res.json()).message).toBe('Question not found.')
})

it('asks for sign in', async () => {
  expect((await get('/api/exams/enem', null)).status).toBe(401)
  expect((await get('/api/exams/enem/topics/funcoes/questions', null)).status).toBe(401)
  expect((await answer(estatistica.id, 'A', null)).status).toBe(401)
})
