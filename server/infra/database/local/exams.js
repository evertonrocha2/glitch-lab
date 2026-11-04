import { randomUUID } from 'node:crypto'

const now = () => new Date().toISOString()

// The source repeats a few questions inside a year: one row per sourceKey, the last copy winning.
const uniqueBySource = (rows) => [...new Map(rows.map((row) => [row.sourceKey, row])).values()]

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

  const attemptsOf = (data) => (data.questionAttempts ??= [])
  const tracksOf = (data) => (data.userTracks ??= [])
  const toAttempt = ({ userId, ...rest }) => ({ ...rest })
  const toTrack = ({ userId, ...rest }) => ({ ...rest })

  // Each question's earliest attempt by this student, in the order they were made.
  function firstAttempts(data, userId) {
    const first = new Map()
    for (const item of attemptsOf(data)) {
      if (item.userId !== userId) continue
      const seen = first.get(item.questionId)
      if (!seen || item.createdAt < seen.createdAt) first.set(item.questionId, item)
    }
    return first
  }

  return {
    // Saves the student's answer unless they already answered that question: { attempt, first }.
    // The check and the push happen with no await in between, so two answers at once save one.
    async recordFirstAttempt(userId, { questionId, choice, correct }) {
      const data = await load()
      const earlier = firstAttempts(data, userId).get(questionId)
      if (earlier) return { attempt: toAttempt(earlier), first: false }
      const row = { id: randomUUID(), userId, questionId, choice, correct, createdAt: now() }
      attemptsOf(data).push(row)
      await save()
      return { attempt: toAttempt(row), first: true }
    },

    async listFirstAttempts(userId, questionIds) {
      const first = firstAttempts(await load(), userId)
      return questionIds.filter((id) => first.has(id)).map((id) => toAttempt(first.get(id)))
    },

    // [{ topic, answered, correct }] from each question's first attempt, for one exam.
    async summarizeExamAttempts(userId, exam) {
      const data = await load()
      const questions = new Map(questionsOf(data).map((item) => [item.id, item]))
      const byTopic = new Map()
      for (const attempt of firstAttempts(data, userId).values()) {
        const question = questions.get(attempt.questionId)
        if (!question || question.exam !== exam || question.topic === null) continue
        const sum = byTopic.get(question.topic) ?? { topic: question.topic, answered: 0, correct: 0 }
        sum.answered++
        if (attempt.correct) sum.correct++
        byTopic.set(question.topic, sum)
      }
      return [...byTopic.values()]
    },

    async listUserTracks(userId) {
      const data = await load()
      return tracksOf(data)
        .filter((item) => item.userId === userId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(toTrack)
    },

    // Adds the track, or changes its exam date when it's already there.
    async upsertUserTrack(userId, trackId, { examDate }) {
      const data = await load()
      let found = tracksOf(data).find((item) => item.userId === userId && item.id === trackId)
      if (found) found.examDate = examDate
      else {
        found = { userId, id: trackId, examDate, createdAt: now() }
        tracksOf(data).push(found)
      }
      await save()
      return toTrack(found)
    },

    async deleteUserTrack(userId, trackId) {
      const tracks = tracksOf(await load())
      const index = tracks.findIndex((item) => item.userId === userId && item.id === trackId)
      if (index === -1) return false
      tracks.splice(index, 1)
      await save()
      return true
    },

    // { inserted, updated }. A row whose topic is null keeps the topic already saved, and an import
    // can raise a review flag but never clear one set by hand. A sourceKey repeated in the batch is
    // saved once, the last copy winning.
    async upsertExamQuestions(rows) {
      const data = await load()
      const questions = questionsOf(data)
      const bySource = new Map(questions.map((item) => [item.sourceKey, item]))
      let inserted = 0
      let updated = 0
      const stamp = now()
      for (const row of uniqueBySource(rows)) {
        const found = bySource.get(row.sourceKey)
        if (found) {
          Object.assign(found, {
            ...structuredClone(row),
            topic: row.topic ?? found.topic,
            needsReview: row.needsReview || found.needsReview,
            updatedAt: stamp,
          })
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
