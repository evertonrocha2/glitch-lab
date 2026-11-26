import { heroLevel, heroXp, studyLedger, talentPoints } from '../../../shared/game/fuel.js'
import { loadDaily } from '../daily/solved.js'
import { loadDuel } from '../duels/solved.js'
import { loadRiddle } from '../glitchdle/solved.js'
import { loadHunt } from '../hunt/solved.js'
import { getProgress } from '../progress/progress.service.js'
import { loadReview } from '../review/review.service.js'

// The study that feeds the hero, read from what the student already did in the app (like getProgress):
// { ledger, level, talentPoints, appXp }. Nothing here is stored; it's worked out on every request.
export async function loadFuel(store, userId, today) {
  const [progress, examDays, cases, challenges, riddle, hunt, duel] = await Promise.all([
    getProgress(store, userId, today),
    store.examAttemptDays(userId, 'enem'),
    store.listCases(userId),
    store.listChallenges(userId),
    loadRiddle(store, userId),
    loadHunt(store, userId),
    loadDuel(store, userId),
  ])
  const [daily, review] = await Promise.all([loadDaily(store, userId, challenges), loadReview(store, userId, challenges)])
  const ledger = studyLedger({ examDays, cases, challenges, daily, riddle, hunt, duel, review })
  const appXp = progress.xp
  const level = heroLevel(heroXp(appXp, ledger))
  return { ledger, level, talentPoints: talentPoints(level.level, ledger.totals.correct), appXp }
}
