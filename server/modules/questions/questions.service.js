import { CARD_MARKER, QUESTION_LIMITS } from '../../../shared/question.js'
import { AppError, badRequest } from '../../core/errors.js'
import { aiFailure } from '../../infra/ai/failure.js'
import { createBoundary, findLeak, guardText, screenInput, scrubHistory } from '../../infra/ai/guard/index.js'
import { spendAiCall } from '../../infra/ai/quota.js'
import { createReplyFilter, saysOffTopic } from '../assistant/answer-stream.js'
import { noEmDash } from '../assistant/specialists.js'
import { clip } from '../assistant/text.js'
import { splitCard } from './card.js'
import { fitHistory, parseConversation } from './request.js'
import { buildTutorPrompt, tutorSystem } from './tutor.prompt.js'

const MAX_REPLY = 3000

// Checks the turn, runs the guard on the new question (and its code), and takes its AI call from
// the daily limit (the global cap included), or throws. Runs before the stream opens, so a bad
// request, the turn cap, the lockout or a used-up limit is plain JSON. A question the guard blocks
// comes back as { blocked } with nothing spent.
export async function startTurn(store, user, body) {
  if (!body) throw badRequest()
  const input = parseConversation(body)
  if (!input.value) throw new AppError(input.status, input.message)
  const last = input.value.messages.at(-1)
  const blocked = await screenInput(store, user, {
    fields: [{ text: last.content }, { text: last.code, prose: false }],
    // Pasted code makes it a programming question, whatever the words around it say.
    scope: last.code ? [] : [last.content],
    feature: 'questions',
  })
  if (blocked) return { ...input.value, blocked }
  await spendAiCall(store, user)
  return { messages: scrubHistory(input.value.messages) }
}

const turnCount = (messages) => {
  const turns = messages.filter((item) => item.role === 'user').length
  return { turns, turnsLeft: Math.max(0, QUESTION_LIMITS.turns - turns) }
}

// The guard's answer for a turn: shown like a normal tutor reply, with no card.
function guardTurn(kind, messages, locale, emit) {
  const reply = guardText(kind, locale)
  emit?.('delta', { text: reply })
  return { reply, card: null, ...turnCount(messages), guard: kind }
}

// One tutor turn, streamed: emit('delta', { text }) as it is written (the CARD line held back),
// then resolves with { reply, card, turns, turnsLeft }. card is the checked card or null.
// Off topic (the tutor's SCOPE line) or a reply that leaks the prompt: the guard's reply instead,
// and the leaking text stops streaming the moment it shows up.
export async function tutorTurn({ ai }, { messages, blocked }, locale, { emit, signal }) {
  if (blocked) return guardTurn(blocked.kind, messages, locale, emit)
  const boundary = createBoundary()
  let shown = ''
  let leaking = false
  const filter = createReplyFilter((piece) => {
    shown += piece
    if (!leaking && findLeak(shown, { boundary })) leaking = true
    if (!leaking) emit('delta', { text: noEmDash(piece) })
  }, CARD_MARKER)
  try {
    const full = await ai.streamText({
      system: tutorSystem(locale, { boundary }),
      prompt: buildTutorPrompt(fitHistory(messages), boundary),
      signal,
      onDelta: (piece) => filter.push(piece),
    })
    if (saysOffTopic(full)) {
      filter.end()
      return guardTurn('off_topic', messages, locale, shown.trim() ? null : emit)
    }
    const { reply, card } = splitCard(full)
    filter.end(reply)
    if (findLeak(full, { boundary })) return guardTurn('leak', messages, locale)
    const text = clip(noEmDash(reply), MAX_REPLY)
    if (!text) throw new Error('The tutor answered with no text')
    return { reply: text, card, ...turnCount(messages) }
  } catch (err) {
    // The student closed the chat or pressed Stop: not a failure worth logging.
    if (signal?.aborted) throw err
    throw aiFailure(err)
  }
}
