// Study fuel for Glitch World: turns what the student already did in the app (exam questions, bugs,
// dailies, glitchdle, hunt, duels, review) into hero XP, level, talent points and per-day rewards.
// Pure: no I/O and no randomness. The hero only ever grows from study, never from idling.
import { topicById } from '../exams/catalog.js'

export const CONCEPT_BRANCH = {
  'wrong-comparison': 'logica',
  'off-by-one': 'logica',
  'missing-return': 'logica',
  other: 'logica',
  'indentation-syntax': 'sintaxe',
  'type-mismatch': 'sintaxe',
  'not-defined': 'sintaxe',
  'key-error': 'sintaxe',
  'index-out-of-range': 'algoritmos',
  'mutation-reference': 'algoritmos',
  'async-await': 'algoritmos',
  'undefined-access': 'algoritmos',
}

export const AREA_BRANCH = { matematica: 'algoritmos', linguagens: 'sintaxe', humanas: 'logica', natureza: 'logica' }

const DAY_FIELDS = [
  'correct', 'wrong', 'examCorrect', 'examWrong', 'bugs', 'dailies', 'glitchdles', 'huntCorrect',
  'duelCorrect', 'duelWins', 'duelLosses', 'reviewRight', 'reviewDone',
]
const emptyRow = (day) => ({ day, ...Object.fromEntries(DAY_FIELDS.map((field) => [field, 0])) })

// input: { examDays, cases, challenges, daily, riddle, hunt, duel, review }, in the shapes the loaders
// already produce (see computeProgress in shared/progress.js). Every part is optional.
// "correct" is the acerto count (spec 8.1): every right answer from every source, summed per day.
export function studyLedger({ examDays = [], cases = [], challenges = [], daily, riddle, hunt, duel, review } = {}) {
  const rows = new Map()
  const row = (day) => {
    if (!rows.has(day)) rows.set(day, emptyRow(day))
    return rows.get(day)
  }
  const branch = { logica: 0, sintaxe: 0, algoritmos: 0 }

  for (const entry of examDays) {
    const target = row(entry.day)
    const correct = entry.correct ?? 0
    target.examCorrect += correct
    target.examWrong += Math.max(0, (entry.answered ?? 0) - correct)
    // An unknown topic still counts toward the totals, just not toward a branch.
    const area = topicById('enem', entry.topic)?.area
    if (AREA_BRANCH[area]) branch[AREA_BRANCH[area]] += correct
  }

  const conceptOf = new Map(cases.map((item) => [item.id, item.concept]))
  for (const item of challenges) {
    // Puzzle challenges are counted by the daily, so only plain bug fixes count here.
    if (item.status !== 'passed' || item.puzzleId || !item.passedAt) continue
    row(item.passedAt.slice(0, 10)).bugs++
    const target = CONCEPT_BRANCH[conceptOf.get(item.caseId)]
    if (target) branch[target]++
  }

  // Global puzzles share daily.solved; only the daily itself counts (as dailySummary and the streak do).
  for (const item of daily?.solved ?? []) if (item.kind === 'daily') row(item.day).dailies++
  for (const item of riddle?.results ?? []) if (item.solved) row(item.day).glitchdles++
  for (const item of hunt?.runs ?? []) row(item.day).huntCorrect += item.correct ?? 0
  for (const item of duel?.results ?? []) {
    const target = row(item.day)
    target.duelCorrect += item.correct ?? 0
    // Practice duels (bot or demo) give acertos but no honor, wins or losses.
    if (item.vsBot) continue
    if (item.outcome === 'win') target.duelWins++
    else if (item.outcome === 'loss') target.duelLosses++
  }
  for (const item of review?.days ?? []) {
    const target = row(item.day)
    target.reviewRight += item.right ?? 0
    if (item.completed) target.reviewDone++
  }

  const days = [...rows.values()].sort((a, b) => a.day.localeCompare(b.day))
  const totals = emptyRow('total')
  for (const item of days) {
    item.wrong = item.examWrong
    item.correct =
      item.examCorrect + item.bugs + item.dailies + item.glitchdles + item.huntCorrect + item.duelCorrect + item.reviewRight
    for (const field of DAY_FIELDS) totals[field] += item[field]
  }
  return { days, totals, branch }
}

export const heroXp = (appXp, ledger) => appXp + 12 * ledger.totals.examCorrect + 3 * ledger.totals.examWrong

export const MAX_LEVEL = 60
export const xpForLevel = (n) => (n <= 1 ? 0 : Math.round(30 * (n - 1) ** 1.8))

export function heroLevel(xp) {
  let level = 1
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++
  const floor = xpForLevel(level)
  return { level, xp, into: xp - floor, needed: level >= MAX_LEVEL ? 0 : xpForLevel(level + 1) - floor }
}

export const ACERTO_POINTS_CAP = 30
export const talentPoints = (level, totalCorrect) =>
  level - 1 + Math.min(Math.floor(totalCorrect / 10), ACERTO_POINTS_CAP)

export const DAILY_CAPS = { fragments: 150, potions: 6 }

const DAY_MS = 24 * 3_600_000
const dayNumber = (day) => Date.parse(`${day}T00:00:00Z`) / DAY_MS

// Rewards are derived from the ledger, never stored, so they can be claimed once and compared later.
export function studyRewards(ledger) {
  const dailyDays = new Set(ledger.days.filter((item) => item.dailies > 0).map((item) => dayNumber(item.day)))
  const rewards = {}
  for (const item of ledger.days) {
    const fragments =
      5 * item.examCorrect + 10 * item.bugs + 15 * item.dailies + 2 * (item.huntCorrect + item.duelCorrect)
    let streak = 0
    if (item.dailies > 0) {
      const today = dayNumber(item.day)
      while (dailyDays.has(today - streak)) streak++
    }
    rewards[item.day] = {
      fragments: Math.min(fragments, DAILY_CAPS.fragments),
      potions: Math.min(3 * item.reviewDone, DAILY_CAPS.potions),
      chest: item.dailies > 0 ? 1 : 0,
      chestBoost: item.dailies > 0 ? Math.min(streak, 7) * 0.1 : 0,
      key: item.glitchdles > 0 ? 1 : 0,
      honor: 10 * item.duelWins + 3 * item.duelLosses,
    }
  }
  return rewards
}

// What is still waiting: earned minus claimed, per day, never below zero.
export function pendingStudy(rewards, claimed = {}) {
  const out = { fragments: 0, potions: 0, chests: [], keys: 0, honor: 0, byDay: {} }
  for (const [day, earned] of Object.entries(rewards)) {
    const done = claimed[day] ?? {}
    const left = (field) => Math.max(0, (earned[field] ?? 0) - (done[field] ?? 0))
    const entry = {
      fragments: left('fragments'), potions: left('potions'), chest: left('chest'), key: left('key'), honor: left('honor'),
    }
    out.fragments += entry.fragments
    out.potions += entry.potions
    out.keys += entry.key
    out.honor += entry.honor
    if (entry.chest) out.chests.push({ day, boost: earned.chestBoost })
    out.byDay[day] = entry
  }
  return out
}
