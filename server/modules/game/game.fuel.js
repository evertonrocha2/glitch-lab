import { heroLevel, heroXp, studyLedger, talentPoints } from '../../../shared/game/fuel.js'
import { computeProgress } from '../../../shared/progress.js'
import { loadProgressInputs } from '../progress/progress.service.js'

// The study that feeds the hero, read from what the student already did in the app (like getProgress):
// { ledger, level, talentPoints, appXp }. Nothing here is stored; it's worked out on every request.
// One read of the progress inputs serves both the app XP and the ledger.
export async function loadFuel(store, userId, today) {
  const [inputs, examDays] = await Promise.all([loadProgressInputs(store, userId), store.examAttemptDays(userId, 'enem')])
  const appXp = computeProgress({ ...inputs, today }).xp
  const { cases, challenges, daily, riddle, hunt, duel, review } = inputs
  const ledger = studyLedger({ examDays, cases, challenges, daily, riddle, hunt, duel, review })
  const level = heroLevel(heroXp(appXp, ledger))
  return { ledger, level, talentPoints: talentPoints(level.level, ledger.totals.correct), appXp }
}
