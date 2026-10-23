import { conceptLabel } from '../shared/concepts.js'
import { generateJson } from '../server/infra/ai/index.js'
import { parseChallenge, toPublicChallenge } from '../server/modules/challenges/challenges.model.js'
import { cron, getDaily, getGlobal, startPuzzle } from '../server/modules/daily/daily.service.js'
import { duelAction, getDuel } from '../server/modules/duels/duels.service.js'
import { getHunt, huntAction } from '../server/modules/hunt/hunt.service.js'
import { fail, ok, readJson, requireUser } from '../server/core/http.js'
import { localeOf } from '../server/core/locale.js'
import { getRiddle, guessRiddle } from '../server/modules/glitchdle/glitchdle.service.js'
import { buildChallengePrompt, CHALLENGE_SCHEMA, challengeSystem } from '../server/modules/challenges/challenge.prompt.js'
import { aiFailure, dailyLimitReached } from '../server/infra/ai/failure.js'
import { getStore } from '../server/infra/database/index.js'
import { takeAiCall } from '../server/infra/ai/quota.js'

// Starts a gym challenge for one of my cases, or resumes the open one (no AI call, no quota).
// With { daily: true, puzzleId } it starts a daily or global puzzle instead, and with
// { riddle: true, mode, guess } it sends a Glitchdle guess.
export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = await readJson(request)
  // Duel: { duel: 'create' | 'join' | 'queue' | 'bot' | 'answer' | 'focus' | 'leave' | 'rematch', ... }.
  if (body?.duel !== undefined) return duelAction(auth.user, body)
  if (body?.riddle !== undefined) return guessRiddle(auth.user, body)
  // Line hunt: { hunt: 'start' | 'answer' | 'next' | 'practice', ... }.
  if (body?.hunt !== undefined) return huntAction(auth.user, body, localeOf(request))
  if (body?.daily !== undefined || body?.puzzleId !== undefined) {
    return typeof body.puzzleId === 'string' ? startPuzzle(auth.user, body.puzzleId) : fail(400, 'Invalid request.')
  }
  if (typeof body?.caseId !== 'string') return fail(400, 'Invalid request.')

  const store = getStore()
  const kase = await store.getCase(auth.user.id, body.caseId)
  if (!kase) return fail(404, 'Case not found.')

  const open = await store.findOpenChallenge(auth.user.id, kase.id)
  if (open) return ok({ challenge: toPublicChallenge(open, kase.concept) })

  if (!(await takeAiCall(store, auth.user))) return dailyLimitReached()

  // Hints and the bug explanation in the reader's language; the symptom stays the real error text.
  const locale = localeOf(request)
  let parsed
  try {
    const answer = await generateJson({
      system: challengeSystem(locale),
      prompt: buildChallengePrompt(
        {
          conceptName: conceptLabel(kase.concept),
          language: kase.language,
          error: kase.error,
          why: kase.analysis.causa,
        },
        locale,
      ),
      schema: CHALLENGE_SCHEMA,
    })
    parsed = parseChallenge(answer)
  } catch (err) {
    return aiFailure(err)
  }

  const record = await store.createChallenge(auth.user.id, { caseId: kase.id, language: kase.language, ...parsed.challenge }, parsed.secret)
  if (kase.status === 'new') await store.updateCase(auth.user.id, kase.id, { status: 'training' })
  return ok({ challenge: toPublicChallenge(record, kase.concept) }, 201)
}

// GET ?id=: one of my challenges. ?daily=1 and ?global=1: the shared puzzles. ?riddle=1: today's
// Glitchdle. ?cron=1: Vercel's daily cron, signed with CRON_SECRET instead of a session.
export async function GET(request) {
  const params = new URL(request.url).searchParams
  if (params.has('cron')) return cron(request)

  const auth = await requireUser(request)
  if (auth.response) return auth.response
  if (params.has('daily')) return getDaily(auth.user)
  if (params.has('global')) return getGlobal(auth.user)
  if (params.has('riddle')) return getRiddle(auth.user)
  // Line hunt: ?hunt=1 for today's run and leaderboard, ?hunt=practice for a practice snippet.
  if (params.has('hunt')) return getHunt(auth.user, params, localeOf(request))
  // Duel: ?duel=lobby for the lobby, ?duel=<id> for one duel's live state.
  if (params.has('duel')) return getDuel(auth.user, params.get('duel'))

  const id = params.get('id') ?? ''
  const store = getStore()
  const record = await store.getChallenge(auth.user.id, id)
  if (!record) return fail(404, 'Challenge not found.')
  if (record.puzzleId) {
    const puzzle = await store.getPuzzle(record.puzzleId)
    return ok({ challenge: toPublicChallenge(record, puzzle?.concept ?? 'other', puzzle) })
  }
  const kase = await store.getCase(auth.user.id, record.caseId)
  return ok({ challenge: toPublicChallenge(record, kase?.concept ?? 'other') })
}
