import { addDays, challengeDay, DIFFICULTIES, weekStart } from '../../../shared/daily.js'
import { generatePuzzle } from './puzzle-generate.js'
import { pickFromPool } from './puzzle-pool.js'

// The cron avoids titles from this many days back.
const RECENT_DAYS = 30

// What a day needs: its three dailies and the global challenge of its week.
export function slotsFor(day) {
  return [...DIFFICULTIES.map((difficulty) => ({ kind: 'daily', day, difficulty })), { kind: 'global', day: weekStart(day), difficulty: 'hard' }]
}

const byDifficulty = (a, b) => DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty)

async function loadSet(store, day) {
  const [dailies, globals] = await Promise.all([
    store.listPuzzles({ kind: 'daily', day }),
    store.listPuzzles({ kind: 'global', day: weekStart(day) }),
  ])
  return { dailies: dailies.sort(byDifficulty), global: globals[0] ?? null }
}

function missingFrom({ dailies, global }, day) {
  return slotsFor(day).filter((slot) => (slot.kind === 'global' ? !global : !dailies.some((item) => item.difficulty === slot.difficulty)))
}

// The day's puzzles, filling any empty slot from the pool first (the cron didn't run, or the AI
// was down). The pool pick depends only on the date, so two requests racing save the same puzzle,
// and the slot's unique key keeps just one.
export async function ensureSet(store, day) {
  const set = await loadSet(store, day)
  const missing = missingFrom(set, day)
  if (missing.length === 0) return set
  for (const slot of missing) {
    const { puzzle, secret } = pickFromPool(slot)
    await store.createPuzzle(puzzle, secret)
  }
  return loadSet(store, day)
}

const slotKey = (slot) => `${slot.kind}:${slot.day}:${slot.difficulty}`
const lower = (title) => title.trim().toLowerCase()

// The daily cron: AI puzzles for today and tomorrow (so the next set is ready the moment the day
// turns), plus the global challenge of each week that has none. Only empty slots are filled, so
// running it twice changes nothing. Today's slots fall back to the pool when the AI fails;
// tomorrow's stay empty for the next run to try again.
export async function runCron(store, now = new Date()) {
  const today = challengeDay(now)
  const tomorrow = addDays(today, 1)
  const [todaySet, tomorrowSet, recent] = await Promise.all([
    loadSet(store, today),
    loadSet(store, tomorrow),
    store.listPuzzles({ since: addDays(today, -RECENT_DAYS) }),
  ])
  const slots = [...missingFrom(todaySet, today), ...missingFrom(tomorrowSet, tomorrow)].filter(
    (slot, index, all) => all.findIndex((other) => slotKey(other) === slotKey(slot)) === index,
  )
  const recentTitles = recent.map((item) => item.title)
  const isToday = (slot) => slot.day === today || (slot.kind === 'global' && slot.day === weekStart(today))

  const answers = await Promise.allSettled(slots.map((slot) => generatePuzzle(slot, recentTitles)))
  const used = new Set(recentTitles.map(lower))
  const created = []
  for (const [index, slot] of slots.entries()) {
    const answer = answers[index]
    if (answer.status === 'rejected') console.error(`Puzzle for ${slotKey(slot)} failed:`, answer.reason)
    // Two answers in one run can still pick the same title; the second one doesn't count.
    let made = answer.status === 'fulfilled' && !used.has(lower(answer.value.puzzle.title)) ? { ...answer.value, source: 'ai' } : null
    if (!made && isToday(slot)) made = { ...pickFromPool(slot), source: 'pool' }
    if (!made) continue
    used.add(lower(made.puzzle.title))
    const saved = await store.createPuzzle(made.puzzle, made.secret)
    if (saved) created.push({ kind: slot.kind, day: slot.day, difficulty: slot.difficulty, title: saved.title, source: made.source })
  }
  return { today, created }
}

// A daily card: what the puzzle is about, never its code, hints or solution.
export const toPuzzleCard = (puzzle) => ({
  id: puzzle.id,
  kind: puzzle.kind,
  day: puzzle.day,
  difficulty: puzzle.difficulty,
  language: puzzle.language,
  concept: puzzle.concept,
  title: puzzle.title,
  symptom: puzzle.symptom,
})

// The card plus where I am on it: new (not started), open or passed.
export const withStatus = (card, challenge) => ({
  ...card,
  status: challenge?.status ?? 'new',
  challengeId: challenge?.id ?? null,
  attempts: challenge?.attempts ?? 0,
})

// A puzzle can be started on its own day (dailies) or during its week (global).
export function isCurrent(puzzle, now = new Date()) {
  const today = challengeDay(now)
  return puzzle.kind === 'global' ? puzzle.day === weekStart(today) : puzzle.day === today
}
