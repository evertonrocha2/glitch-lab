import { CONCEPTS } from '../../../shared/concepts.js'
import { CARD_LIMITS, CARD_MARKER, knownLanguage } from '../../../shared/question.js'
import { stripMarkers } from '../../infra/ai/guard/output.js'
import { lastMarker } from '../assistant/answer-stream.js'

// Once the tutor knows what the doubt is about, it ends its message with one machine line:
//   CARD: {"concept":"off-by-one","topic":"...","language":"python","title":"...","summary":"...",
//          "explanation":"...","exercise":{"prompt":"...","answer":"..."},"recap":"..."}
// The student never sees that line. The server checks it strictly and offers it as a board card.

const CONCEPT_IDS = new Set(CONCEPTS.map((concept) => concept.id))
const EM_DASH = /—/

// A trimmed, non-empty text under `max` with no em dash, or null.
function cleanText(value, max) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text || text.length > max || EM_DASH.test(text)) return null
  return text
}

// The card rebuilt field by field, or null when anything required is missing or off.
// language: a language the app knows, or null for a doubt not tied to one. recap is optional:
// a broken one is dropped, the card stays.
export function parseCard(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  if (!CONCEPT_IDS.has(raw.concept)) return null
  let language = null
  if (raw.language !== null && raw.language !== undefined && raw.language !== '') {
    language = knownLanguage(raw.language)
    if (!language) return null
  }
  const topic = cleanText(raw.topic, CARD_LIMITS.topic)
  const title = cleanText(raw.title, CARD_LIMITS.title)
  const summary = cleanText(raw.summary, CARD_LIMITS.summary)
  const explanation = cleanText(raw.explanation, CARD_LIMITS.explanation)
  const exercise = raw.exercise && typeof raw.exercise === 'object' ? raw.exercise : {}
  const prompt = cleanText(exercise.prompt, CARD_LIMITS.prompt)
  const answer = cleanText(exercise.answer, CARD_LIMITS.answer)
  if (![topic, title, summary, explanation, prompt, answer].every(Boolean)) return null
  const recap = cleanText(raw.recap, CARD_LIMITS.recap)
  return { concept: raw.concept, topic, language, title, summary, explanation, exercise: { prompt, answer }, ...(recap ? { recap } : {}) }
}

// The finished text as { reply, card }: what comes before the last CARD line (any other marker
// line, an echo of the student's text, taken out), and the checked card after it (null when there
// is none or it is broken).
export function splitCard(text) {
  const full = String(text ?? '')
  const marker = lastMarker(full, CARD_MARKER)
  if (!marker) return { reply: stripMarkers(full), card: null }
  const reply = stripMarkers(full.slice(0, marker.start))
  const rest = full.slice(marker.end)
  const start = rest.indexOf('{')
  const end = rest.lastIndexOf('}')
  if (start === -1 || end < start) return { reply, card: null }
  try {
    return { reply, card: parseCard(JSON.parse(rest.slice(start, end + 1))) }
  } catch {
    return { reply, card: null }
  }
}
