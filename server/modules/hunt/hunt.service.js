import { challengeDay, nextResetAt } from '../../../shared/daily.js'
import { ANSWER_GRACE_MS, compareRuns, HUNT_ROUNDS, huntXp, ROUND_MS, roundPoints } from '../../../shared/hunt/game.js'
import { HUNT_POOL, poolSnippetById } from '../../../shared/hunt/snippets.js'
import { badRequest, conflict, notFound } from '../../core/errors.js'
import { LEADERBOARD_SIZE, who } from '../daily/leaderboard.js'
import { ensureHuntDay, symptomOf } from './hunt-daily.js'

// Line hunt: find the buggy line before the clock runs out.
// The server times every round: a round starts when its snippet is served and ends when the answer
// arrives, both stamped here. A snippet's bug line only leaves the server once it's answered.

const ACTIONS = ['start', 'answer', 'next']
const iso = (ms) => new Date(ms).toISOString()
const pick = (text, locale) => (locale === 'pt-BR' ? text?.pt : text?.en) ?? text?.en ?? ''

// What a player sees while a round runs: never the line or the explanation.
const question = (snippet, locale) => ({
  language: snippet.language,
  symptom: pick(symptomOf(snippet.symptom), locale),
  code: snippet.code,
})

// A round after it's answered: the right line, what I picked, the explanation and the bug type.
const reveal = (snippet, round, locale) => ({
  ...question(snippet, locale),
  answer: snippet.line,
  concept: snippet.concept,
  explanation: pick(snippet.explanation, locale),
  picked: round.picked,
  correct: round.correct,
  timedOut: round.timedOut,
  ms: round.ms,
  points: round.points,
})

// Score, right lines and time spent from the answered rounds; finished once all of them are.
function totals(rounds) {
  const answered = rounds.filter((round) => round.answeredAt)
  return {
    score: answered.reduce((sum, round) => sum + round.points, 0),
    correct: answered.filter((round) => round.correct).length,
    ms: answered.reduce((sum, round) => sum + round.ms, 0),
    done: answered.length === HUNT_ROUNDS,
  }
}

const live = (run) => {
  const last = run?.rounds.at(-1)
  return last && !last.answeredAt ? last : null
}

// A served round nobody answered in time (a closed tab, a lost connection) counts as a miss.
function expire(run, now) {
  const round = live(run)
  if (!round || now <= Date.parse(round.servedAt) + ROUND_MS + ANSWER_GRACE_MS) return null
  return [...run.rounds.slice(0, -1), { ...round, answeredAt: iso(Date.parse(round.servedAt) + ROUND_MS), picked: null, correct: false, timedOut: true, ms: ROUND_MS, points: 0 }]
}

// Saves new rounds with their totals, only over the version I read. null when another write won.
async function saveRounds(store, userId, run, rounds, now) {
  const { score, correct, ms, done } = totals(rounds)
  const finishedAt = done ? (run.finishedAt ?? iso(now)) : null
  return store.saveHuntRun(userId, run.day, { rounds, score, correct, ms, finishedAt }, run.version)
}

// My run with any expired round settled first (saved, so a reload sees the same).
async function currentRun(store, userId, day, now) {
  const run = await store.getHuntRun(userId, day)
  const rounds = expire(run, now)
  if (!rounds) return run
  return (await saveRounds(store, userId, run, rounds, now)) ?? store.getHuntRun(userId, day)
}

// My run as the browser sees it.
export function publicRun(set, run, now, locale) {
  if (!run) return null
  const { score, correct, ms } = totals(run.rounds)
  const round = live(run)
  const answered = run.rounds.filter((item) => item.answeredAt)
  const index = run.rounds.length - 1
  return {
    finished: Boolean(run.finishedAt),
    score,
    correct,
    ms,
    xp: huntXp(correct),
    results: answered.map((item, at) => ({ index: at, ...reveal(set.snippets[at], item, locale) })),
    current: round
      ? { index, ...question(set.snippets[index], locale), remainingMs: Math.max(0, Date.parse(round.servedAt) + ROUND_MS - now) }
      : null,
    nextIndex: !round && !run.finishedAt ? run.rounds.length : null,
  }
}

// Today's top 10 (finished runs, demo accounts left out by the store) and where I stand.
export async function huntBoard(store, day, userId) {
  const runs = (await store.huntDayRuns(day)).sort(compareRuns)
  const top = runs.slice(0, LEADERBOARD_SIZE)
  const profiles = await Promise.all(top.map((item) => store.getProfile(item.userId)))
  const mine = runs.findIndex((item) => item.userId === userId)
  return {
    players: runs.length,
    leaderboard: top.map((item, index) => ({
      rank: index + 1,
      ...who(profiles[index], item.userId),
      score: item.score,
      correct: item.correct,
      seconds: Math.round(item.ms / 1000),
      isYou: item.userId === userId,
    })),
    you: mine === -1 ? null : { rank: mine + 1, score: runs[mine].score, correct: runs[mine].correct },
  }
}

async function state(store, user, day, run, now, locale) {
  const set = await ensureHuntDay(store, day)
  return {
    day,
    nextResetAt: nextResetAt(new Date(now)),
    rounds: HUNT_ROUNDS,
    roundMs: ROUND_MS,
    isDemo: Boolean(user.isDemo),
    run: publicRun(set, run, now, locale),
    ...(await huntBoard(store, day, user.id)),
  }
}

// A pool snippet for practice: random, never one of today's (that would hand out today's answers)
// and never the one just played.
export function practicePick(exclude, random = Math.random) {
  const choices = HUNT_POOL.filter((item) => !exclude.has(item.id))
  const list = choices.length > 0 ? choices : HUNT_POOL
  return list[Math.floor(random() * list.length)]
}

// Today's run, where I am in it, and the leaderboard.
export async function getHunt(store, user, locale, now = Date.now()) {
  const day = challengeDay(new Date(now))
  const run = await currentRun(store, user.id, day, now)
  return state(store, user, day, run, now, locale)
}

// One practice snippet, without its line, never the one just played (`after`).
export async function practiceSnippet(store, after, locale, now = Date.now()) {
  const set = await ensureHuntDay(store, challengeDay(new Date(now)))
  const exclude = new Set([...set.snippets.map((item) => item.id), after])
  const snippet = practicePick(exclude)
  return { roundMs: ROUND_MS, snippet: { id: snippet.id, ...question(snippet, locale) } }
}

const validLine = (line, code) => line === null || (Number.isInteger(line) && line >= 1 && line <= code.length)

// { id, line }: grades one practice answer. No XP, nothing saved. Today's snippets are never
// practice, so their lines can't be fished out from here.
export async function practiceAnswer(store, body, locale, now = Date.now()) {
  const { id, line } = body ?? {}
  const snippet = poolSnippetById(id)
  const today = await ensureHuntDay(store, challengeDay(new Date(now)))
  if (!snippet || today.snippets.some((item) => item.id === snippet.id)) throw notFound('Snippet not found.')
  if (!validLine(line, snippet.code)) throw badRequest('Pick a line of the snippet.')
  const correct = line === snippet.line
  return { result: reveal(snippet, { picked: line, correct, timedOut: line === null, ms: null, points: 0 }, locale) }
}

// action 'start' | 'answer' | 'next', with { day?, index?, line? }.
// start: begins today's run (one a day) and serves its first snippet; a second start just answers
// with the run. answer: grades the live round with the server's clock (line null means time ran out).
// next: serves the next snippet. `day` (optional) catches a request sent from yesterday's page.
export async function huntAction(store, user, action, input, locale, now = Date.now()) {
  if (!ACTIONS.includes(action)) throw badRequest()
  const body = input ?? {}
  const day = challengeDay(new Date(now))
  if (body.day !== undefined && body.day !== day) throw conflict('A new line hunt just started. Reload to play it.')
  const set = await ensureHuntDay(store, day)
  let run = await currentRun(store, user.id, day, now)

  if (action === 'start') {
    if (!run) run = (await store.createHuntRun(user.id, { day, rounds: [{ servedAt: iso(now) }] })) ?? (await store.getHuntRun(user.id, day))
    return state(store, user, day, run, now, locale)
  }
  if (!run) throw conflict("Start today's line hunt first.")

  if (action === 'next') {
    if (run.finishedAt) throw conflict('Your line hunt for today is over. Come back tomorrow.')
    if (!live(run)) {
      run = await store.saveHuntRun(user.id, day, { ...totalsOf(run), rounds: [...run.rounds, { servedAt: iso(now) }] }, run.version)
      if (!run) throw conflict('Another hunt answer landed at the same time. Try again.')
    }
    return state(store, user, day, run, now, locale)
  }

  // answer
  const round = live(run)
  const index = run.rounds.length - 1
  if (!round || body.index !== index) throw conflict('That snippet is over. Load the next one.')
  const snippet = set.snippets[index]
  if (!validLine(body.line, snippet.code)) throw badRequest('Pick a line of the snippet.')
  const elapsed = Math.max(0, now - Date.parse(round.servedAt))
  const late = elapsed > ROUND_MS + ANSWER_GRACE_MS
  const timedOut = body.line === null || late
  const correct = !timedOut && body.line === snippet.line
  const ms = Math.min(elapsed, ROUND_MS)
  const answered = { ...round, answeredAt: iso(now), picked: body.line, correct, timedOut, ms, points: roundPoints(correct, ms) }
  const saved = await saveRounds(store, user.id, run, [...run.rounds.slice(0, -1), answered], now)
  if (!saved) throw conflict('Another hunt answer landed at the same time. Try again.')
  return { result: { index, ...reveal(snippet, answered, locale) }, ...(await state(store, user, day, saved, now, locale)) }
}

// The stored totals of a run, carried over unchanged when only a new round is served.
const totalsOf = (run) => ({ score: run.score, correct: run.correct, ms: run.ms, finishedAt: run.finishedAt })
