import { computeProgress } from '../shared/progress.js'
import { clientDay, serverDay } from './_lib/days.js'
import { POST as addStudyTime } from './_lib/handlers/study.js'
import { ok, requireUser } from './_lib/http.js'
import { getStore } from './_lib/store/index.js'

// POST: the study timer reports time (shares this function to stay under Vercel's free-plan limit).
export const POST = addStudyTime

// XP, level, streak and badges, worked out fresh from what the student has done.
export async function GET(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const store = getStore()
  const userId = auth.user.id
  const [cases, challenges, notes, study] = await Promise.all([
    store.listCases(userId),
    store.listChallenges(userId),
    store.listNotes(userId),
    store.listStudyTime(userId),
  ])
  const today = clientDay(new URL(request.url).searchParams.get('today')) ?? serverDay()
  return ok({ progress: computeProgress({ cases, challenges, notes, study, today }) })
}
