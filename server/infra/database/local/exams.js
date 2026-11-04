import { randomUUID } from 'node:crypto'

const now = () => new Date().toISOString()

// Newest exam first, then question order: the order a topic's questions are practiced in.
const byYearThenNumber = (a, b) => b.year - a.year || a.number - b.number

// Exam questions in the local JSON file. Spread into createLocalStore.
export function createLocalExams({ load, save }) {
  // Files saved before exams existed don't have the list yet.
  const questionsOf = (data) => (data.examQuestions ??= [])
  const visible = (item) => item.topic !== null && !item.needsReview

  function toQuestion(row) {
    const { createdAt, updatedAt, ...rest } = row
    return structuredClone(rest)
  }

  return {
    // { inserted, updated }. A row whose topic is null keeps the topic already saved.
    async upsertExamQuestions(rows) {
      const data = await load()
      const questions = questionsOf(data)
      const bySource = new Map(questions.map((item) => [item.sourceKey, item]))
      let inserted = 0
      let updated = 0
      const stamp = now()
      for (const row of rows) {
        const found = bySource.get(row.sourceKey)
        if (found) {
          Object.assign(found, { ...structuredClone(row), topic: row.topic ?? found.topic, updatedAt: stamp })
          updated++
        } else {
          const created = { id: randomUUID(), ...structuredClone(row), createdAt: stamp, updatedAt: stamp }
          questions.push(created)
          bySource.set(row.sourceKey, created)
          inserted++
        }
      }
      await save()
      return { inserted, updated }
    },

    async listUntaggedExamQuestions(exam, limit) {
      const data = await load()
      return questionsOf(data)
        .filter((item) => item.exam === exam && item.topic === null && !item.needsReview)
        .sort(byYearThenNumber)
        .slice(0, limit)
        .map(toQuestion)
    },

    async setExamQuestionTopic(id, topic) {
      const data = await load()
      const found = questionsOf(data).find((item) => item.id === id)
      if (!found) return false
      found.topic = topic
      found.updatedAt = now()
      await save()
      return true
    },

    async countExamQuestionsByTopic(exam) {
      const data = await load()
      const counts = {}
      for (const item of questionsOf(data)) {
        if (item.exam === exam && visible(item)) counts[item.topic] = (counts[item.topic] ?? 0) + 1
      }
      return counts
    },

    async listExamQuestions(exam, topic, { offset, limit }) {
      const data = await load()
      return questionsOf(data)
        .filter((item) => item.exam === exam && item.topic === topic && visible(item))
        .sort(byYearThenNumber)
        .slice(offset, offset + limit)
        .map(toQuestion)
    },

    async getExamQuestion(id) {
      const data = await load()
      const found = questionsOf(data).find((item) => item.id === id)
      return found ? toQuestion(found) : null
    },
  }
}
