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
