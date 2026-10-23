import { activityCalendar } from '../shared/activity.js'
import { computeProgress } from '../shared/progress.js'
import { clientDay, serverDay } from '../server/core/days.js'
import { POST as addStudyTime } from '../server/modules/progress/study.service.js'
import { ok, requireUser } from '../server/core/http.js'
import { loadDuel } from '../server/modules/duels/solved.js'
import { loadHunt } from '../server/modules/hunt/solved.js'
import { loadInterrogation } from '../server/modules/interrogation/solved.js'
import { loadDaily } from '../server/modules/daily/solved.js'
import { loadRiddle } from '../server/modules/glitchdle/solved.js'
import { getReview, loadReview, reviewAction } from '../server/modules/review/review.service.js'
import { skillMap } from '../shared/skills.js'
import { getStore } from '../server/infra/database/index.js'

// POST: the study timer reports time (shares this function to stay under Vercel's free-plan limit).
// POST ?review=start | answer: spaced review sessions (see _lib/review/play.js).
export function POST(request) {
  if (new URL(request.url).searchParams.has('review')) return reviewAction(request)
  return addStudyTime(request)
}

// XP, level, streak and badges, worked out fresh from what the student has done.
// GET ?review=1: today's spaced review (what's due, the open session).
export async function GET(request) {
  if (new URL(request.url).searchParams.has('review')) return getReview(request)
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
  // Daily line hunts played, for their XP, the eagle-eye badge and the activity graph.
  const hunt = await loadHunt(store, userId)
  // Community events: entries sent, places won, votes received, events hosted.
  const events = await store.eventStats(userId)
  // Interrogations finished, for their XP and the scientific-method badge.
  const interrogation = await loadInterrogation(store, userId)
  // Spaced review boxes and days, for their XP, the elephant-memory badge, the graph and the skill map.
  const review = await loadReview(store, userId, challenges)
  const progress = computeProgress({ cases, challenges, notes, study, today, trails, daily, community, riddle, hunt, duel, events, interrogation, review })
  return ok({
    progress: {
      ...progress,
      activity: activityCalendar({ cases, challenges, notes, study, riddle, hunt, duel, events, review }, today),
      skills: skillMap({ cases, challenges, items: review.items, puzzleConcepts: review.puzzleConcepts }),
    },
  })
}
