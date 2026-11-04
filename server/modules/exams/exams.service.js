import { examById, topicById, trackById } from '../../../shared/exams/catalog.js'
import { badRequest, notFound } from '../../core/errors.js'
import { pageOf } from '../../core/validation.js'
import { CHOICES, MESSAGES, QUESTIONS_PAGE, toPublicQuestion } from './exams.model.js'

const MAX_PAGE = 100

function knownExam(id) {
  const exam = examById(id)
  if (!exam) throw notFound(MESSAGES.examNotFound)
  return exam
}

// The exam's areas and topics, each topic with how many questions it has and how the student did.
export async function getExamOverview(store, user, examId) {
  const exam = knownExam(examId)
  const [counts, summary, tracks] = await Promise.all([
    store.countExamQuestionsByTopic(exam.id),
    store.summarizeExamAttempts(user.id, exam.id),
    store.listUserTracks(user.id),
  ])
  const stats = new Map(summary.map((item) => [item.topic, item]))
  const track = tracks.find((item) => trackById(item.id)?.exam === exam.id)
  return {
    id: exam.id,
    name: exam.name,
    joined: Boolean(track),
    examDate: track?.examDate ?? null,
    areas: exam.areas.map((area) => ({
      id: area.id,
      name: area.name,
      shortName: area.shortName,
      topics: area.topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        questions: counts[topic.id] ?? 0,
        answered: stats.get(topic.id)?.answered ?? 0,
        correct: stats.get(topic.id)?.correct ?? 0,
      })),
    })),
  }
}

// One page of a topic's questions, each with the student's first answer when there is one.
export async function listTopicQuestions(store, user, examId, topicId, pageValue) {
  const exam = knownExam(examId)
  const topic = topicById(exam.id, topicId)
  if (!topic) throw notFound(MESSAGES.topicNotFound)
  const page = pageOf(pageValue, MAX_PAGE)
  const found = await store.listExamQuestions(exam.id, topic.id, { offset: (page - 1) * QUESTIONS_PAGE, limit: QUESTIONS_PAGE + 1 })
  const questions = found.slice(0, QUESTIONS_PAGE)
  const attempts = new Map((await store.listFirstAttempts(user.id, questions.map((item) => item.id))).map((item) => [item.questionId, item]))
  return {
    topic,
    questions: questions.map((question) => toPublicQuestion(question, attempts.get(question.id))),
    page,
    hasMore: found.length > QUESTIONS_PAGE,
  }
}

// { choice }. The first answer is the one that counts: answering again gives it back (first: false)
// and records nothing.
export async function answerQuestion(store, user, id, body) {
  if (!CHOICES.includes(body.choice)) throw badRequest(MESSAGES.badChoice)
  const question = await store.getExamQuestion(id)
  if (!question || question.needsReview || question.topic === null || !examById(question.exam)) throw notFound(MESSAGES.questionNotFound)
  const [earlier] = await store.listFirstAttempts(user.id, [question.id])
  if (earlier) return { attempt: toPublicQuestion(question, earlier).attempt, first: false }
  const attempt = await store.createQuestionAttempt(user.id, { questionId: question.id, choice: body.choice, correct: body.choice === question.answer })
  return { attempt: toPublicQuestion(question, attempt).attempt, first: true }
}
