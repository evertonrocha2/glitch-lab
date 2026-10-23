import { randomUUID } from 'node:crypto'
import { isDue, newReviewItem, REVIEW_SESSION_CARDS, REVIEW_XP, REVIEW_XP_CARDS_PER_DAY, reviewDayXp, reviewQueue, scheduleReview } from '../../../shared/review.js'
import { clientDay, serverDay } from '../days.js'
import { fail, ok, readJson, requireUser } from '../http.js'
import { localeOf } from '../locale.js'
import { poolEntryFor, poolText } from '../puzzles/pool.js'
import { getStore } from '../store/index.js'
import { buildCard, poolSamples, publicCard, seededRandom } from './cards.js'

// Spaced review, served from /api/progress to stay under Vercel's free-plan function limit.
// GET ?review=1 is today's overview; POST ?review=start opens (or resumes) a session and
// POST ?review=answer grades one card. No AI: cards come from the student's own data.

const NOTHING_DUE = 'Nothing to review right now.'
const SESSION_GONE = "This review is over. Open today's review again."
const CLASH = 'Another answer landed at the same time. Try again.'
const ATTEMPTS = 3

const newestFirst = (list) => [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
const isDone = (session) => session.answers.length >= session.cards.length

async function studentData(store, userId) {
  const [cases, challenges, items] = await Promise.all([store.listCases(userId), store.listChallenges(userId), store.listReviewItems(userId)])
  return { cases, challenges, items, puzzles: await passedPuzzles(store, challenges) }
}

// The daily and global puzzles a student passed (they count as concepts met).
async function passedPuzzles(store, challenges) {
  const ids = [...new Set(challenges.filter((item) => item.puzzleId && item.status === 'passed').map((item) => item.puzzleId))]
  return ids.length ? store.listPuzzles({ ids }) : []
}

const metConcepts = ({ cases, puzzles }) => [...cases.map((item) => item.concept), ...puzzles.map((item) => item.concept)]

// For GET /api/progress: { items, days, puzzleConcepts }, for XP, the badge, the activity graph and the skill map.
export async function loadReview(store, userId, challenges) {
  const [items, days, puzzles] = await Promise.all([store.listReviewItems(userId), store.listReviewDays(userId), passedPuzzles(store, challenges)])
  return { items, days, puzzleConcepts: puzzles.map((item) => item.concept) }
}

// Everything a card for `concept` can be built from, the student's own first: their latest cases
// (real error messages), their latest gym challenge on it and a puzzle they passed (both with the
// fix, for "which line?" and "pick the fix"), then the hand-written pool.
async function samplesFor(store, concept, { cases, challenges, puzzles }, locale) {
  const own = newestFirst(cases.filter((item) => item.concept === concept))
  const samples = own.slice(0, 2).map((kase) => ({ error: kase.error, code: kase.code, explanation: kase.analysis?.causa ?? null, language: kase.language }))
  const ownIds = new Set(own.map((item) => item.id))
  const challenge = newestFirst(challenges.filter((item) => item.caseId && ownIds.has(item.caseId)))[0]
  const challengeSecret = challenge && (await store.getChallengeSecret(challenge.id))
  if (challengeSecret) {
    samples.push({ symptom: challenge.symptom, code: challenge.brokenCode, solution: challengeSecret.solution, explanation: challengeSecret.bugExplanation, language: challenge.language })
  }
  const puzzle = puzzles.find((item) => item.concept === concept)
  const puzzleSecret = puzzle && (await store.getPuzzleSecret(puzzle.id))
  if (puzzleSecret) {
    // A day the cron fell back to the pool saved the English text; the pool has it translated.
    const pool = poolEntryFor(puzzle.brokenCode)
    const text = pool ? poolText(pool, locale) : { symptom: puzzle.symptom, bugExplanation: puzzleSecret.bugExplanation }
    samples.push({ symptom: text.symptom, code: puzzle.brokenCode, solution: puzzleSecret.solution, explanation: text.bugExplanation, language: puzzle.language })
  }
  return [...samples, ...poolSamples(concept, locale)]
}

async function newSession(store, data, today, locale) {
  const due = reviewQueue(data.items, metConcepts(data), today)
    .filter((item) => isDue(item, today))
    .slice(0, REVIEW_SESSION_CARDS)
  const seed = randomUUID()
  const random = seededRandom(seed)
  const cards = []
  for (const item of due) {
    const card = buildCard(item.concept, await samplesFor(store, item.concept, data, locale), { turn: item.right + item.wrong, random })
    if (card) cards.push(card)
  }
  return cards.length ? { id: randomUUID(), seed, cards, answers: [] } : null
}

// What an answered card reveals.
const feedback = (card, { index, choice, correct }) => ({
  index,
  choice,
  correct,
  answer: card.answer,
  concept: card.concept,
  explanation: card.explanation ?? null,
  fixed: card.fixed?.trim() ?? null,
})

// A session as the browser sees it: the cards without answers, and the feedback of those answered.
export const publicSession = (session) => ({
  id: session.id,
  cards: session.cards.map(publicCard),
  answers: session.answers.map((answer) => feedback(session.cards[answer.index], answer)),
  right: session.answers.filter((answer) => answer.correct).length,
  done: isDone(session),
})

const dayTally = (row) => ({ cards: row?.cards ?? 0, right: row?.right ?? 0, completed: row?.completed ?? false, xp: reviewDayXp(row?.right ?? 0) })

const todayOf = (value) => clientDay(value) ?? serverDay()

// GET ?review=1&today=: what's due, the open session (if any) and today's tally.
export async function getReview(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  const store = getStore()
  const today = todayOf(new URL(request.url).searchParams.get('today'))
  const [data, row] = await Promise.all([studentData(store, auth.user.id), store.getReviewDay(auth.user.id, today)])
  const queue = reviewQueue(data.items, metConcepts(data), today)
  const due = queue.filter((item) => isDue(item, today))
  const open = row?.session && !isDone(row.session) ? row.session : null
  return ok({
    review: {
      today,
      met: queue.length,
      due: due.map(({ concept, box }) => ({ concept, box })),
      nextDueDay: due.length ? today : (queue[0]?.dueDay ?? null),
      session: open ? publicSession(open) : null,
      day: dayTally(row),
      xpCap: REVIEW_XP_CARDS_PER_DAY * REVIEW_XP.card,
    },
  })
}

// POST ?review=start | answer.
export async function reviewAction(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  const action = new URL(request.url).searchParams.get('review')
  const body = (await readJson(request)) ?? {}
  const today = todayOf(body.today)
  if (action === 'start') return start(auth.user, today, localeOf(request))
  if (action === 'answer') return answer(auth.user, today, body)
  return fail(400, 'Invalid request.')
}

// Resumes today's open session, or opens a new one with the concepts due.
async function start(user, today, locale) {
  const store = getStore()
  const row = await store.getReviewDay(user.id, today)
  if (row?.session && !isDone(row.session)) return ok({ session: publicSession(row.session) })

  const session = await newSession(store, await studentData(store, user.id), today, locale)
  if (!session) return fail(409, NOTHING_DUE)
  const saved = await store.saveReviewDay(user.id, today, { ...dayTally(row), session }, row?.version ?? 0)
  if (saved) return ok({ session: publicSession(saved.session) }, 201)
  // Another tab opened one at the same moment: use that one.
  const again = await store.getReviewDay(user.id, today)
  if (again?.session && !isDone(again.session)) return ok({ session: publicSession(again.session) })
  return fail(409, CLASH)
}

// Grades one card ({ sessionId, index, choice }), moves the concept's box and tallies the day.
async function answer(user, today, { sessionId, index, choice }) {
  if (typeof sessionId !== 'string' || !Number.isInteger(index) || typeof choice !== 'string') return fail(400, 'Invalid request.')
  const store = getStore()
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const row = await store.getReviewDay(user.id, today)
    const session = row?.session
    if (!session || session.id !== sessionId) return fail(409, SESSION_GONE)
    const card = session.cards[index]
    if (!card || !card.options.some((option) => option.id === choice)) return fail(400, 'Invalid request.')
    // Answering twice (a double click, a retry) gets the first answer back, and changes nothing.
    const earlier = session.answers.find((item) => item.index === index)
    if (earlier) return ok({ result: feedback(card, earlier), xp: 0, session: publicSession(session), day: dayTally(row) })

    const correct = choice === card.answer
    const answers = [...session.answers, { index, choice, correct }]
    const next = { ...session, answers }
    const saved = await store.saveReviewDay(
      user.id,
      today,
      { session: next, cards: row.cards + 1, right: row.right + (correct ? 1 : 0), completed: row.completed || isDone(next) },
      row.version,
    )
    if (!saved) continue

    const items = await store.listReviewItems(user.id)
    const item = scheduleReview(items.find((stored) => stored.concept === card.concept) ?? newReviewItem(card.concept, today), correct, today)
    await store.saveReviewItem(user.id, item)
    const xp = correct && saved.right <= REVIEW_XP_CARDS_PER_DAY ? REVIEW_XP.card : 0
    return ok({
      result: feedback(card, { index, choice, correct }),
      item: { concept: item.concept, box: item.box, dueDay: item.dueDay },
      xp,
      session: publicSession(saved.session),
      day: dayTally(saved),
    })
  }
  return fail(409, CLASH)
}
