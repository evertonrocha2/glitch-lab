import { detectInFields, detectInjection } from './injection.js'
import { guardText } from './messages.js'
import { precheckScope } from './scope.js'
import { assertAiAllowed, recordStrike } from './strikes.js'

// The guard every AI feature that reads a student's words goes through, in this order:
// 1. the daily lockout (too many blocked attempts today: 429),
// 2. the local injection detector (a hit is a strike and a refusal, no AI call, no quota),
// 3. the local scope check for obvious off-topic or unreadable text (a refusal, no strike),
// then the AI call, whose prompt fences the data and asks the model for an off-topic signal,
// and the output guard on the answer.

export { createBoundary, fenceData, guardRules, CANARY } from './fence.js'
export { detectInjection } from './injection.js'
export { precheckScope } from './scope.js'
export { findLeak, secretLines, repeatsLines, squash, stripMarkers } from './output.js'
export { GUARD_TEXT, guardText, LOCKED_MESSAGE } from './messages.js'
export { assertAiAllowed, recordStrike, STRIKE_LIMIT, strikeKey } from './strikes.js'

// fields: [{ text, prose }] checked for injection (prose false for code, errors and files).
// scope: texts a person typed to the AI, checked for obvious off-topic or gibberish.
// Resolves to null (go on) or { kind: 'injection' | 'off_topic' | 'gibberish', rule? }.
export async function screenInput(store, user, { fields = [], scope = [], feature }) {
  await assertAiAllowed(store, user)
  const filled = fields.filter((field) => typeof field.text === 'string' && field.text)
  const hit = detectInFields(filled)
  if (hit) {
    await recordStrike(store, user, { rule: hit.rule, text: filled[hit.field].text, feature })
    return { kind: 'injection', rule: hit.rule }
  }
  for (const text of scope) {
    const kind = precheckScope(text)
    if (kind) return { kind }
  }
  return null
}

const REMOVED = '(message removed by the app)'

// Older messages of a chat come back from the client with every turn. One that would be blocked now
// (an attempt the guard already refused, or a forged assistant turn) is blanked out of the prompt,
// with no new strike: only the newest message is the student's new input.
export function scrubHistory(messages) {
  return messages.map((item, index) => {
    if (index === messages.length - 1) return item
    const hit = detectInjection(item.content) || (item.code && detectInjection(item.code, { prose: false }))
    return hit ? { ...item, content: REMOVED, ...(item.code ? { code: '' } : {}) } : item
  })
}

// A blocked verdict's text for the reader.
export const refusalFor = (verdict, locale) => guardText(verdict.kind, locale)
