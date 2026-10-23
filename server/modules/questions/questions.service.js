import { CARD_MARKER, QUESTION_LIMITS } from '../../../shared/question.js'
import { AppError, badRequest } from '../../core/errors.js'
import { aiFailure } from '../../infra/ai/failure.js'
import { spendAiCall } from '../../infra/ai/quota.js'
import { createReplyFilter } from '../assistant/answer-stream.js'
import { noEmDash } from '../assistant/specialists.js'
import { clip } from '../assistant/text.js'
import { splitCard } from './card.js'
import { fitHistory, parseConversation } from './request.js'
import { buildTutorPrompt, tutorSystem } from './tutor.prompt.js'

const MAX_REPLY = 3000

// Checks the turn and takes its AI call from the daily limit (the global cap included), or throws.
// Runs before the stream opens, so a bad request, the turn cap or a used-up limit is plain JSON.
export async function startTurn(store, user, body) {
  if (!body) throw badRequest()
  const input = parseConversation(body)
  if (!input.value) throw new AppError(input.status, input.message)
  await spendAiCall(store, user)
  return input.value
}

// One tutor turn, streamed: emit('delta', { text }) as it is written (the CARD line held back),
// then resolves with { reply, card, turns, turnsLeft }. card is the checked card or null.
export async function tutorTurn({ ai }, { messages }, locale, { emit, signal }) {
  const filter = createReplyFilter((piece) => emit('delta', { text: noEmDash(piece) }), CARD_MARKER)
  try {
    const full = await ai.streamText({
      system: tutorSystem(locale),
      prompt: buildTutorPrompt(fitHistory(messages)),
      signal,
      onDelta: (piece) => filter.push(piece),
    })
    filter.end()
    const { reply, card } = splitCard(full)
    const text = clip(noEmDash(reply), MAX_REPLY)
    if (!text) throw new Error('The tutor answered with no text')
    const turns = messages.filter((item) => item.role === 'user').length
    return { reply: text, card, turns, turnsLeft: Math.max(0, QUESTION_LIMITS.turns - turns) }
  } catch (err) {
    // The student closed the chat or pressed Stop: not a failure worth logging.
    if (signal?.aborted) throw err
    throw aiFailure(err)
  }
}
