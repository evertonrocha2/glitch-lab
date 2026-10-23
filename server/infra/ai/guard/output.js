import { BOUNDARY_PATTERN, CANARY } from './fence.js'
import { normalize } from './normalize.js'

// The output guard: after the model answers, before the student sees it. An answer that recites
// the system prompt (the canary phrase), shows the data fence or its token, or repeats a secret
// (a reference solution line, a hint not revealed yet) is replaced with a safe one.

const MIN_LINE = 6
const MIN_SECRET = 20
// Code looks like code: brackets, operators, dots between names, or a keyword line.
const CODE_LIKE = /[(){}[\];=<>]|\w\.\w|^\s*(return|if|for|while|def|const|let|var|import)\b/

// Whitespace, quotes and case don't hide a copied line.
export const squash = (text) => String(text ?? '').replace(/[\s`'"]+/g, '').toLowerCase()

// The code lines of `secret` that `known` (code the student already has) doesn't, squashed.
export function secretLines(secret = '', known = '') {
  const have = squash(known)
  const lines = String(secret)
    .split('\n')
    .flatMap((line) => line.split('`'))
    .filter((line) => CODE_LIKE.test(line))
    .map(squash)
    .filter((line) => line.length >= MIN_LINE && !have.includes(line))
  return [...new Set(lines)]
}

export const repeatsLines = (text, lines) => {
  const squashed = squash(text)
  return lines.some((line) => squashed.includes(line))
}

const CANARY_WORDS = CANARY.split('-').slice(0, 2).join('[\\s_-]*')
const CANARY_PATTERN = new RegExp(CANARY_WORDS, 'i')
// Bits of the shared rules that only show up when an answer copies them.
const RULE_ECHOES = [/scope and safety \(internal reference/, /data blocks start with a line/, /<<<\s*(?:data|end)\b/]

// What leaked, or null. secrets: { lines } (squashed code lines, from secretLines) and { texts }
// (hints and other prose the student must not see yet).
export function findLeak(text, { boundary, lines = [], texts = [] } = {}) {
  const answer = String(text ?? '')
  if (!answer) return null
  const plain = normalize(answer)
  if (CANARY_PATTERN.test(plain) || RULE_ECHOES.some((pattern) => pattern.test(plain))) return 'system_prompt'
  if ((boundary && answer.includes(boundary)) || BOUNDARY_PATTERN.test(answer)) return 'boundary'
  if (lines.length && repeatsLines(answer, lines)) return 'secret'
  const squashed = squash(answer)
  if (texts.some((secret) => squash(secret).length >= MIN_SECRET && squashed.includes(squash(secret)))) return 'secret'
  return null
}

// Marker lines (ACTIONS:, CARD:, SCOPE:) left inside a reply: the model echoing what the student
// wrote. Only the last marker line of a streamed answer is the server's; the rest never shows.
const MARKER_LINE = /^[ \t*_`>#-]*(?:ACTIONS|CARD|SCOPE):.*$/gm
export const stripMarkers = (text) =>
  String(text ?? '')
    .replace(MARKER_LINE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
