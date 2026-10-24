import { serverDay } from '../../core/days.js'
import { AppError, badRequest } from '../../core/errors.js'
import { spendUsage } from '../../core/usage.js'
import { withAi } from '../../infra/ai/failure.js'
import { createBoundary, findLeak, GUARD_TEXT, screenInput } from '../../infra/ai/guard/index.js'
import { DAILY_AI_LIMIT, dailyLimitReached, spendAiCall } from '../../infra/ai/quota.js'
import { seedDemo } from '../demo/demo.seed.js'
import { parseCard } from '../questions/card.js'
import { parseConversation } from '../questions/request.js'
import { parseAnalysis, validateInput } from './analysis.js'
import { analyzeSystem, buildPrompt, RESPONSE_SCHEMA } from './analyze.prompt.js'
import { questionCase, sameQuestion } from './from-question.js'

export async function listCases(store, user, locale) {
  // A demo visitor lands on a ready-made board (their own copy), so every column has something to click.
  if (user.isDemo) await seedDemo(store, user.id, undefined, locale)
  return store.listCases(user.id)
}

export const REPEAT_WINDOW_MS = 10 * 60 * 1000

const sameInput = (item, input) =>
  item.kind !== 'question' &&
  item.error === input.error &&
  (item.code ?? '') === input.code &&
  (item.context ?? '') === input.context &&
  JSON.stringify(item.files ?? []) === JSON.stringify(input.files)

async function recentSameCase(store, userId, input, same = sameInput, now = Date.now()) {
  const cases = await store.listCases(userId)
  return cases.find((item) => now - Date.parse(item.createdAt) < REPEAT_WINDOW_MS && same(item, input)) ?? null
}

// A board card from a doubt chat ({ messages, card }): the card the tutor proposed, checked again
// here, and the chat it came from. No AI call: everything is already written. The same card sent
// again within the window gets the case it already made.
export async function createFromQuestion({ store }, user, body) {
  if (!body) throw badRequest()
  const conversation = parseConversation(body, { endsWithUser: false })
  if (!conversation.value) throw new AppError(conversation.status, conversation.message)
  const card = parseCard(body.card)
  if (!card) throw badRequest('This card is incomplete. Keep chatting so the tutor can propose a new one.')
  const input = questionCase(conversation.value.messages, card)
  const repeat = await recentSameCase(store, user.id, input, sameQuestion)
  if (repeat) return { case: repeat, created: false }
  // The card comes back from the browser, so the server can't tell it from a made-up one; each case
  // pays XP. A real card costs a tutor turn, so no more cases a day than the AI limit allows turns.
  const limit = user.isDemo ? DAILY_AI_LIMIT.demo : DAILY_AI_LIMIT.user
  if (!(await spendUsage(store, `question-cases:${user.id}`, serverDay(), limit))) throw dailyLimitReached()
  return { case: await store.createCase(user.id, input), created: true }
}

// The AI reads an error (and the code around it) and the result becomes a new case on the board.
export async function analyzeError({ store, ai }, user, body, locale) {
  if (!body) throw badRequest()
  const input = validateInput(body)
  if (!input.ok) throw new AppError(input.status, input.message)

  // The same error sent again (a double click, a resend) gets the case it already made, for free.
  const repeat = await recentSameCase(store, user.id, input.value)
  if (repeat) return repeat

  const blocked = await screenInput(store, user, analyzeFields(input.value))
  if (blocked) throw notAnalyzed(blocked.kind)

  await spendAiCall(store, user)
  // Explanation, clues and exercise come back in the reader's language; the error stays as printed.
  const boundary = createBoundary()
  const parsed = await withAi(async () => {
    const answer = await ai.generateJson({ system: analyzeSystem(locale, { boundary }), prompt: buildPrompt(input.value, locale, boundary), schema: RESPONSE_SCHEMA })
    if (answer?.off_topic === true) return { guard: 'off_topic' }
    if (findLeak(JSON.stringify(answer), { boundary })) return { guard: 'leak' }
    return parseAnalysis(answer)
  })
  if (parsed.guard) throw notAnalyzed(parsed.guard)
  return store.createCase(user.id, { ...input.value, ...parsed })
}

// What the guard reads of a new investigation. The error, code and files are code-like text; what
// the student was doing is their own words. With no code or files, the error is all there is to
// tell a real error from a poem, so it gets the scope check too.
function analyzeFields({ error, code, context, files }) {
  const bare = !code.trim() && !files.length
  return {
    fields: [
      { text: error, prose: false },
      { text: code, prose: false },
      { text: context },
      ...files.flatMap((file) => [
        { text: file.path, prose: false },
        { text: file.content, prose: false },
      ]),
    ],
    scope: [...(bare ? [error] : []), ...(context ? [context] : [])],
    feature: 'analyze',
  }
}

// The form shows this like any other "can't investigate this" message: no case, no AI call spent
// for a local block. English here; the client translates it.
const notAnalyzed = (kind) => new AppError(422, GUARD_TEXT[kind === 'injection' || kind === 'leak' ? kind : 'not_an_error'].en, 'AI_GUARD')
