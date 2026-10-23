import { activityCalendar } from '../../../shared/activity.js'
import { computeProgress } from '../../../shared/progress.js'
import { skillMap } from '../../../shared/skills.js'
import { loadDaily } from '../daily/solved.js'
import { loadDuel } from '../duels/solved.js'
import { loadRiddle } from '../glitchdle/solved.js'
import { loadHunt } from '../hunt/solved.js'
import { loadInterrogation } from '../interrogation/solved.js'
import { loadReview } from '../review/review.service.js'

// XP, level, streak and badges, worked out fresh from what the student has done.
export async function getProgress(store, userId, today) {
  const [cases, challenges, notes, study, trails, community] = await Promise.all([
    store.listCases(userId),
    store.listChallenges(userId),
    store.listNotes(userId),
    store.listStudyTime(userId),
    store.listTrails(userId),
    // Articles written, likes and valid ratings received, comments written.
    store.communityStats(userId),
  ])
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
  return {
    ...progress,
    activity: activityCalendar({ cases, challenges, notes, study, riddle, hunt, duel, events, review }, today),
    skills: skillMap({ cases, challenges, items: review.items, puzzleConcepts: review.puzzleConcepts }),
  }
}
