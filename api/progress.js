import { activityCalendar } from '../shared/activity.js'
import { computeProgress } from '../shared/progress.js'
import { clientDay, serverDay } from './_lib/days.js'
import { POST as addStudyTime } from './_lib/handlers/study.js'
import { ok, requireUser } from './_lib/http.js'
import { loadDuel } from './_lib/duel/solved.js'
import { loadDaily } from './_lib/puzzles/solved.js'
import { loadRiddle } from './_lib/riddle/solved.js'
import { getStore } from './_lib/store/index.js'

// POST: the study timer reports time (shares this function to stay under Vercel's free-plan limit).
export const POST = addStudyTime

// XP, level, streak and badges, worked out fresh from what the student has done.
export async function GET(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const store = getStore()
  const userId = auth.user.id
  const [cases, challenges, notes, study, trails, community] = await Promise.all([
    store.listCases(userId),
    store.listChallenges(userId),
    store.listNotes(userId),
    store.listStudyTime(userId),
    store.listTrails(userId),
    // Articles written, likes and valid ratings received, comments written.
    store.communityStats(userId),
  ])
  const today = clientDay(new URL(request.url).searchParams.get('today')) ?? serverDay()
  // Daily and global puzzles passed, and Glitchdle games, for their XP, streaks and badges.
  const [daily, riddle] = await Promise.all([loadDaily(store, userId, challenges), loadRiddle(store, userId)])
  // Duels finished, for their XP, the duel badges and the activity graph.
  const duel = await loadDuel(store, userId)
  const progress = computeProgress({ cases, challenges, notes, study, today, trails, daily, community, riddle, duel })
  return ok({ progress: { ...progress, activity: activityCalendar({ cases, challenges, notes, study, riddle, duel }, today) } })
}
