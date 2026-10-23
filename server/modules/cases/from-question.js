import { QUESTION_LIMITS } from '../../../shared/question.js'
import { clip } from '../assistant/text.js'

// A question case from a doubt chat and the card the tutor proposed (already checked by parseCard).
// The analysis keeps the shape of an investigated case, so the drawer, exports and review read it:
// the summary is "what happened", the explanation is "why", and there is no fix to hide.
// Only a short recap of the chat is kept, never the transcript.
export function questionCase(messages, card) {
  const asked = messages.filter((item) => item.role === 'user')
  const code = asked.findLast((item) => item.code)?.code ?? ''
  const recap = card.recap ?? clip(asked.map((item) => item.content.trim().split('\n')[0]).join('\n'), QUESTION_LIMITS.recap)
  return {
    kind: 'question',
    error: '',
    code,
    context: '',
    files: [],
    question: asked[0].content.trim(),
    topic: card.topic,
    title: card.title,
    recap,
    concept: card.concept,
    // The case column needs a language; a doubt that isn't about one says so like the analyzer does.
    language: card.language ?? 'unknown',
    analysis: {
      explicacao: card.summary,
      causa: card.explanation,
      correcao: '',
      exercicio: { enunciado: card.exercise.prompt, resposta: card.exercise.answer },
    },
  }
}

// The same card asked for again (a double click, a resend): same doubt, same topic and title.
export const sameQuestion = (item, input) =>
  item.kind === 'question' && item.question === input.question && item.topic === input.topic && item.title === input.title && item.concept === input.concept
