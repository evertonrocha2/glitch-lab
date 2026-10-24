import { clientDay } from '../../core/days.js'
import { badRequest } from '../../core/errors.js'
import { isId } from '../../core/validation.js'
import { attachReport } from '../study/study.service.js'

// The timer reports about once a minute; 10 minutes covers a slow or sleeping tab.
export const MAX_STUDY_SECONDS_PER_REPORT = 600
export const MAX_STUDY_SECONDS_PER_DAY = 16 * 3600

// { seconds, day, sessionId? }: adds time to that day (capped) and answers with the day's total.
// With a sessionId the same seconds also go to that open timer run in the study log (never more
// than the day counted), and the answer says which run to report to next.
export async function addStudyTime(store, user, body) {
  const seconds = body?.seconds
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_STUDY_SECONDS_PER_REPORT) throw badRequest()
  const day = clientDay(body.day)
  if (!day) throw badRequest()
  const { sessionId } = body
  if (sessionId !== undefined && sessionId !== null && !isId(sessionId)) throw badRequest()
  const todaySeconds = await store.addStudyTime(user.id, day, seconds, MAX_STUDY_SECONDS_PER_DAY)
  if (!sessionId) return { todaySeconds }
  return { todaySeconds, sessionId: await attachReport(store, user, sessionId, { day, seconds }) }
}
