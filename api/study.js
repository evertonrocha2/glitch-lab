import { clientDay } from './_lib/days.js'
import { fail, ok, readJson, requireUser } from './_lib/http.js'
import { getStore } from './_lib/store/index.js'

// The timer reports about once a minute; 10 minutes covers a slow or sleeping tab.
export const MAX_STUDY_SECONDS_PER_REPORT = 600
export const MAX_STUDY_SECONDS_PER_DAY = 16 * 3600

export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = await readJson(request)
  const seconds = body?.seconds
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_STUDY_SECONDS_PER_REPORT) return fail(400, 'Invalid request.')
  const day = clientDay(body.day)
  if (!day) return fail(400, 'Invalid request.')

  const todaySeconds = await getStore().addStudyTime(auth.user.id, day, seconds, MAX_STUDY_SECONDS_PER_DAY)
  return ok({ todaySeconds })
}
