import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'

// A question as scripts/import-enem.mjs saves it. Every test uses its own exam id, since the
// Supabase test database is shared and outlives each test.
export const examQuestion = (exam, overrides = {}) => ({
  exam,
  year: 2023,
  number: 1,
  area: 'matematica',
  language: null,
  topic: null,
  context: 'Uma loja vende...',
  statement: 'O valor pago foi',
  alternatives: ['A', 'B', 'C', 'D', 'E'].map((letter) => ({ letter, text: `opção ${letter}`, image: null })),
  answer: 'B',
  needsReview: false,
  sourceKey: `test:${randomUUID()}`,
  ...overrides,
})

const newExam = () => `exam-${randomUUID()}`

// Exam questions: every store must pass these. storeContract calls this inside its describe.
export function examsStoreContract(getStore) {
  it('upserts questions by sourceKey and never clears a topic', async () => {
    const store = getStore()
    const exam = newExam()
    const rows = [examQuestion(exam, { number: 1 }), examQuestion(exam, { number: 2 })]
    expect(await store.upsertExamQuestions(rows)).toEqual({ inserted: 2, updated: 0 })
    const [first] = await store.listUntaggedExamQuestions(exam, 10)
    expect(first).toMatchObject({ ...rows[0], id: expect.any(String) })
    expect(await store.setExamQuestionTopic(first.id, 'funcoes')).toBe(true)

    const again = rows.map((row) => ({ ...row, statement: 'Novo enunciado', topic: null }))
    expect(await store.upsertExamQuestions(again)).toEqual({ inserted: 0, updated: 2 })
    expect(await store.getExamQuestion(first.id)).toMatchObject({ statement: 'Novo enunciado', topic: 'funcoes' })
    // A topic sent by the import (foreign languages) does land.
    await store.upsertExamQuestions([{ ...rows[1], topic: 'estatistica' }])
    expect(await store.countExamQuestionsByTopic(exam)).toEqual({ funcoes: 1, estatistica: 1 })
  })

  it("lists only a topic's visible questions, newest year first", async () => {
    const store = getStore()
    const exam = newExam()
    await store.upsertExamQuestions([
      examQuestion(exam, { year: 2021, number: 10, topic: 'funcoes' }),
      examQuestion(exam, { year: 2023, number: 5, topic: 'funcoes' }),
      examQuestion(exam, { year: 2023, number: 2, topic: 'funcoes' }),
      examQuestion(exam, { year: 2023, number: 1, topic: 'funcoes', needsReview: true }),
      examQuestion(exam, { year: 2023, number: 3, topic: 'estatistica' }),
    ])
    const order = (list) => list.map((item) => `${item.year}/${item.number}`)
    expect(order(await store.listExamQuestions(exam, 'funcoes', { offset: 0, limit: 10 }))).toEqual(['2023/2', '2023/5', '2021/10'])
    expect(order(await store.listExamQuestions(exam, 'funcoes', { offset: 1, limit: 1 }))).toEqual(['2023/5'])
    expect(await store.countExamQuestionsByTopic(exam)).toEqual({ funcoes: 3, estatistica: 1 })
  })

  it('lists untagged questions for the AI pass, never ones in review', async () => {
    const store = getStore()
    const exam = newExam()
    await store.upsertExamQuestions([
      examQuestion(exam, { number: 1 }),
      examQuestion(exam, { number: 2 }),
      examQuestion(exam, { number: 3, needsReview: true }),
      examQuestion(exam, { number: 4, topic: 'funcoes' }),
    ])
    expect((await store.listUntaggedExamQuestions(exam, 10)).map((item) => item.number)).toEqual([1, 2])
    expect(await store.listUntaggedExamQuestions(exam, 1)).toHaveLength(1)
  })

  it('answers null for a question that does not exist', async () => {
    const store = getStore()
    expect(await store.getExamQuestion(randomUUID())).toBeNull()
    expect(await store.getExamQuestion('not-a-uuid')).toBeNull()
    expect(await store.setExamQuestionTopic(randomUUID(), 'funcoes')).toBe(false)
  })
}
