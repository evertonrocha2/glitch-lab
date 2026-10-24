import { addDays, STUDY_LOG } from '../../../shared/study-log.js'
import { clientDay, serverDay } from '../../core/days.js'
import { badRequest, notFound, tooMany, valueOrThrow } from '../../core/errors.js'
import { manualDayOk, MESSAGES, parseLink, parseTime, parseTopic, rangeOk, startFitsDay } from './study.model.js'

// The timer reports about once a minute, and one report carries at most 10 minutes: a run that
// hasn't grown for longer than this was left in a closed tab or a sleeping laptop.
export const STALE_RUN_MS = 12 * 60_000
// A run can start a little before its first request reaches us (a slow network, a retry).
const START_SLACK_MS = 15 * 60_000
const DEMO_KEY = (userId) => `study-session:${userId}`

// The last moment a run was seen alive: its start plus the seconds the timer reported for it.
const lastSeen = (session) => new Date(Date.parse(session.startedAt) + session.seconds * 1000).toISOString()

// Each link must be one of the student's own cases or notes. Answers { caseId?, noteId? }, with
// only the fields that were sent (null clears a link).
async function parseLinks(store, userId, body) {
  const caseId = parseLink(body.caseId)
  const noteId = parseLink(body.noteId)
  if (caseId === false || noteId === false) throw badRequest()
  if (caseId && !(await store.getCase(userId, caseId))) throw badRequest(MESSAGES.caseNotYours)
  if (noteId && !(await store.getNote(userId, noteId))) throw badRequest(MESSAGES.noteNotYours)
  return { ...(caseId !== undefined ? { caseId } : {}), ...(noteId !== undefined ? { noteId } : {}) }
}

// Demo accounts can log, up to a number of sessions a day.
async function checkDemo(store, user) {
  if (!user.isDemo) return
  if ((await store.countUsage(DEMO_KEY(user.id), serverDay())) >= STUDY_LOG.demoSessionsPerDay) throw tooMany(MESSAGES.demoLimit)
}
async function countDemo(store, user) {
  if (user.isDemo) await store.addUsage(DEMO_KEY(user.id), serverDay())
}

// Ends a timer run where it was last seen (or at `at`), dropping it when it's too short.
const closeRun = (store, userId, session, at = lastSeen(session)) =>
  store.closeStudySession(userId, session.id, clampEnd(session, Date.parse(at)), STUDY_LOG.minSessionSeconds)

// An end time between the run's start and now.
function clampEnd(session, time, now = Date.now()) {
  return new Date(Math.min(Math.max(time, Date.parse(session.startedAt)), now)).toISOString()
}

// Runs nobody closed (the tab went away before it could): ended where they were last seen.
async function closeStaleRuns(store, userId, now = Date.now()) {
  const open = await store.listOpenStudySessions(userId)
  for (const session of open) if (now - Date.parse(lastSeen(session)) > STALE_RUN_MS) await closeRun(store, userId, session)
}

// GET ?from&to (days, both included; the last 30 days by default): the sessions and each day's
// counted study time in that range.
export async function listSessions(store, user, { from, to }) {
  const last = to ?? addDays(serverDay(), 1)
  const first = from ?? addDays(last, -30)
  if (!rangeOk(first, last)) throw badRequest()
  await closeStaleRuns(store, user.id)
  const [sessions, study] = await Promise.all([store.listStudySessions(user.id, { from: first, to: last }), store.listStudyTime(user.id)])
  return { sessions, days: study.filter((item) => item.day >= first && item.day <= last) }
}

// The timer starts: { topic?, caseId?, noteId?, day, startedAt? }. Any other run still open ends
// first, so the reports that follow go to this one.
export async function startSession(store, user, body) {
  const topic = valueOrThrow(parseTopic(body.topic, { required: false }))
  const day = clientDay(body.day)
  if (!day) throw badRequest()
  const links = await parseLinks(store, user.id, body)
  await checkDemo(store, user)
  const now = Date.now()
  const asked = body.startedAt === undefined ? now : parseTime(body.startedAt)
  if (asked === null) throw badRequest()
  const startedAt = new Date(Math.min(Math.max(asked, now - START_SLACK_MS), now)).toISOString()
  for (const session of await store.listOpenStudySessions(user.id)) await closeRun(store, user.id, session)
  const created = await store.createStudySession(user.id, { day, startedAt, endedAt: null, seconds: 0, topic, ...links, source: 'timer' })
  await countDemo(store, user)
  return created
}

// The timer paused, reset or found its tab gone: { endedAt? } (the last heartbeat). Answers the
// closed session, or null when it was too short to keep.
export async function stopSession(store, user, id, body) {
  const session = await store.getStudySession(user.id, id)
  if (!session || session.source !== 'timer') throw notFound(MESSAGES.notFound)
  const asked = body.endedAt === undefined ? Date.now() : parseTime(body.endedAt)
  if (asked === null) throw badRequest()
  const result = await closeRun(store, user.id, session, new Date(asked).toISOString())
  if (!result) throw notFound(MESSAGES.notFound)
  return result.dropped ? null : result.session
}

// A past session logged by hand: { day, startedAt?, minutes, topic, caseId?, noteId? }. It shows
// in the log but never adds study time, so it gives no XP, streak, badge or activity.
export async function createManual(store, user, body) {
  const topic = valueOrThrow(parseTopic(body.topic, { required: true }))
  if (!manualDayOk(body.day, serverDay())) throw badRequest(MESSAGES.manualDay)
  const { minutes } = body
  if (!Number.isInteger(minutes) || minutes < STUDY_LOG.manualMinMinutes || minutes > STUDY_LOG.manualMaxMinutes) {
    throw badRequest(MESSAGES.manualLength)
  }
  const seconds = minutes * 60
  let startedAt = `${body.day}T12:00:00.000Z`
  let endedAt = null
  if (body.startedAt !== undefined && body.startedAt !== null) {
    const time = parseTime(body.startedAt)
    // Logged sessions are in the past: they must have ended by now (a minute of clock drift is fine).
    if (time === null || !startFitsDay(time, body.day) || time + seconds * 1000 > Date.now() + 60_000) throw badRequest(MESSAGES.manualStart)
    startedAt = new Date(time).toISOString()
    endedAt = new Date(time + seconds * 1000).toISOString()
  }
  const links = await parseLinks(store, user.id, body)
  await checkDemo(store, user)
  const created = await store.createStudySession(user.id, { day: body.day, startedAt, endedAt, seconds, topic, ...links, source: 'manual' })
  await countDemo(store, user)
  return created
}

// Topic and links only. A manual entry keeps a topic; a timer run may have none.
export async function updateSession(store, user, id, body) {
  const session = await store.getStudySession(user.id, id)
  if (!session) throw notFound(MESSAGES.notFound)
  const patch = await parseLinks(store, user.id, body)
  if (body.topic !== undefined) patch.topic = valueOrThrow(parseTopic(body.topic, { required: session.source === 'manual' }))
  if (!Object.keys(patch).length) throw badRequest()
  return store.updateStudySession(user.id, id, patch)
}

// Deleting a timer session leaves the time it counted where it is: the day's total doesn't change.
export async function deleteSession(store, user, id) {
  if (!(await store.deleteStudySession(user.id, id))) throw notFound(MESSAGES.notFound)
}

// A timer report's seconds, already counted for `day`, also go to its open run. Answers the id
// the timer should report to next: the same one, a new one when the run crossed midnight, or null
// when the run is gone (closed, deleted, or replaced by a run started elsewhere).
export async function attachReport(store, user, sessionId, { day, seconds }) {
  const result = await store.attachStudySeconds(user.id, sessionId, { day, seconds })
  if (!result) return null
  if (result.status === 'attached') return result.session.id
  // Past midnight: yesterday's run ends where it was, and the same topic carries on today.
  const old = result.session
  await closeRun(store, user.id, old)
  const startedAt = new Date(Date.now() - seconds * 1000).toISOString()
  const next = await store.createStudySession(user.id, {
    day,
    startedAt,
    endedAt: null,
    seconds: 0,
    topic: old.topic,
    caseId: old.caseId,
    noteId: old.noteId,
    source: 'timer',
  })
  const attached = await store.attachStudySeconds(user.id, next.id, { day, seconds })
  return attached?.status === 'attached' ? next.id : null
}
