import { clientDay } from '../../core/days.js'
import { badRequest } from '../../core/errors.js'

// The timer reports about once a minute; 10 minutes covers a slow or sleeping tab.
export const MAX_STUDY_SECONDS_PER_REPORT = 600
export const MAX_STUDY_SECONDS_PER_DAY = 16 * 3600

// { seconds, day }: adds time to that day (capped) and answers with the day's total.
export async function addStudyTime(store, user, body) {
  const seconds = body?.seconds
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_STUDY_SECONDS_PER_REPORT) throw badRequest()
  const day = clientDay(body.day)
  if (!day) throw badRequest()
  return { todaySeconds: await store.addStudyTime(user.id, day, seconds, MAX_STUDY_SECONDS_PER_DAY) }
}
