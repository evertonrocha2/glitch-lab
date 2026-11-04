import { addDays } from '../../../shared/study-log.js'

// The message texts are part of the API: the client translates them by exact text
// (src/lib/i18n/messages/server.js).
export const MESSAGES = {
  examNotFound: 'Exam not found.',
  topicNotFound: 'Topic not found.',
  questionNotFound: 'Question not found.',
  badChoice: 'Pick one of the alternatives.',
  trackNotFound: 'Track not found.',
  badExamDate: 'Pick an exam date from today up to 3 years ahead.',
  noExamDate: 'This track has no exam date.',
}

export const CHOICES = ['A', 'B', 'C', 'D', 'E']

// How many questions a page of a topic holds.
export const QUESTIONS_PAGE = 10

// A question as a student sees it. The official answer only rides along inside their own attempt,
// once they answered; review flags and import keys never leave the server.
export function toPublicQuestion(question, attempt) {
  return {
    id: question.id,
    year: question.year,
    number: question.number,
    area: question.area,
    topic: question.topic,
    context: question.context,
    statement: question.statement,
    alternatives: question.alternatives.map(({ letter, text, image }) => ({ letter, text, image })),
    attempt: attempt ? { choice: attempt.choice, correct: attempt.correct, answer: question.answer } : null,
  }
}

const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/
// A real calendar day: 2027-02-30 doesn't read back as itself.
const isDay = (value) => typeof value === 'string' && DAY_FORMAT.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)

// { value } (a day or null) or { status, message }. today is the server's day; one day earlier is
// fine too, since the student's clock can be a day behind ours.
export function parseExamDate(value, today) {
  if (value === undefined || value === null) return { value: null }
  if (!isDay(value) || value < addDays(today, -1) || value > addDays(today, 3 * 366)) return { status: 400, message: MESSAGES.badExamDate }
  return { value }
}
