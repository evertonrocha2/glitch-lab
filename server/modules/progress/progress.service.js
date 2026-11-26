import { activityCalendar } from '../../../shared/activity.js'
import { computeProgress } from '../../../shared/progress.js'
import { skillMap } from '../../../shared/skills.js'
import { loadDaily } from '../daily/solved.js'
import { loadDuel } from '../duels/solved.js'
import { loadRiddle } from '../glitchdle/solved.js'
import { loadHunt } from '../hunt/solved.js'
import { loadInterrogation } from '../interrogation/solved.js'
import { loadReview } from '../review/review.service.js'

// Everything XP, level, streak and badges are worked out from, read once (all reads, so the
// independent ones run together). Glitch World's study fuel shares these instead of loading them again.
export async function loadProgressInputs(store, userId) {
  const [cases, challenges, notes, study, trails, community, riddle, duel, hunt, events, interrogation] = await Promise.all([
    store.listCases(userId),
    store.listChallenges(userId),
    store.listNotes(userId),
    store.listStudyTime(userId),
    store.listTrails(userId),
    // Articles written, likes and valid ratings received, comments written.
    store.communityStats(userId),
    // Glitchdle games, for their XP, streaks and badges.
    loadRiddle(store, userId),
    // Duels finished, for their XP, the duel badges and the activity graph.
    loadDuel(store, userId),
    // Daily line hunts played, for their XP, the eagle-eye badge and the activity graph.
    loadHunt(store, userId),
    // Community events: entries sent, places won, votes received, events hosted.
    store.eventStats(userId),
    // Interrogations finished, for their XP and the scientific-method badge.
    loadInterrogation(store, userId),
  ])
  // Both need the challenges: daily and global puzzles passed, and the spaced review boxes and days
  // (for their XP, the elephant-memory badge, the graph and the skill map).
  const [daily, review] = await Promise.all([loadDaily(store, userId, challenges), loadReview(store, userId, challenges)])
  return { cases, challenges, notes, study, trails, daily, community, riddle, hunt, duel, events, interrogation, review }
}

// XP, level, streak and badges, worked out fresh from what the student has done.
export async function getProgress(store, userId, today) {
  const inputs = await loadProgressInputs(store, userId)
  const { cases, challenges, notes, study, riddle, hunt, duel, events, review } = inputs
  return {
    ...computeProgress({ ...inputs, today }),
    activity: activityCalendar({ cases, challenges, notes, study, riddle, hunt, duel, events, review }, today),
    skills: skillMap({ cases, challenges, items: review.items, puzzleConcepts: review.puzzleConcepts }),
  }
}
