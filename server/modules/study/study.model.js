import { addDays, cleanTopic, STUDY_LOG } from '../../../shared/study-log.js'
import { isId } from '../../core/validation.js'

const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/
const HOUR_MS = 3_600_000

export const MESSAGES = {
  topicLong: `Keep the topic up to ${STUDY_LOG.topic} characters.`,
  topicMissing: 'Write what you studied.',
  manualDay: `Pick a day within the last ${STUDY_LOG.manualDays} days.`,
  manualLength: `Log from ${STUDY_LOG.manualMinMinutes} minutes to ${STUDY_LOG.manualMaxMinutes / 60} hours.`,
  manualStart: 'Pick a start time on that day that has already passed.',
  caseNotYours: 'That case is not on your board.',
  noteNotYours: 'That note is not in your notes.',
  notFound: 'Study session not found.',
  demoLimit: `Demo accounts can log ${STUDY_LOG.demoSessionsPerDay} study sessions a day. Sign up to keep going.`,
}

export const isDay = (value) => typeof value === 'string' && DAY_FORMAT.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))

// { value } or { status, message }. required: a manual entry must say what was studied; a timer
// run may start without a topic.
export function parseTopic(value, { required }) {
  if (value === undefined || value === null) return required ? { status: 400, message: MESSAGES.topicMissing } : { value: '' }
  if (typeof value !== 'string') return { status: 400, message: 'Invalid request.' }
  const topic = cleanTopic(value)
  if (topic.length > STUDY_LOG.topic) return { status: 400, message: MESSAGES.topicLong }
  if (required && !topic) return { status: 400, message: MESSAGES.topicMissing }
  return { value: topic }
}

// A link field: undefined (not sent), null (no link) or an id. false when it's neither.
export function parseLink(value) {
  if (value === undefined || value === null) return value
  return isId(value) ? value : false
}

// An ISO time the client sent, as ms; null when it isn't one.
export function parseTime(value) {
  if (typeof value !== 'string' || value.length > 40) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

// A day for a hand-logged session: today or one of the 6 days before, on the student's clock.
// The server's date can be a day off from theirs (time zones), so one more day each way is fine.
export function manualDayOk(day, today) {
  return isDay(day) && day <= addDays(today, 1) && day >= addDays(today, -STUDY_LOG.manualDays)
}

// A start time "on that day" in some time zone: between 14 hours before its UTC midnight and
// 14 hours after its UTC end (the widest offsets there are).
export function startFitsDay(time, day) {
  const midnight = Date.parse(`${day}T00:00:00Z`)
  return time >= midnight - 14 * HOUR_MS && time < midnight + 38 * HOUR_MS
}

// Keeps a date range a list may ask for: both days valid, in order, and not too long.
export function rangeOk(from, to) {
  if (!isDay(from) || !isDay(to) || from > to) return false
  return Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) <= STUDY_LOG.maxRangeDays * 24 * HOUR_MS
}
