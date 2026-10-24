// Note tags: rules shared by the API (which enforces them) and the editor (which applies them as you type).
// tags: per note, tag: characters per tag.
export const NOTE_TAG_LIMITS = { tags: 8, tag: 24 }

export const NOTE_TAG_CHARS = 'Note tags use letters, numbers, spaces and - . # +.'
const TOO_MANY = `Use up to ${NOTE_TAG_LIMITS.tags} tags.`
const TOO_LONG = `Keep each tag up to ${NOTE_TAG_LIMITS.tag} characters.`

// \p{M} as well: a decomposed accent that NFC can't merge is still part of the word.
const ALLOWED = /^[\p{L}\p{M}\p{N} .#+-]+$/u
const HAS_WORD = /[\p{L}\p{N}]/u

// "  #JavaScript   Loops " -> "javascript loops". Lowercase so "Laço" and "laço" are one tag, but the
// accent stays: "laco" is a different word. A leading # is the hashtag habit, so "c#" keeps its own.
export function normalizeTag(text) {
  return String(text ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^#+\s*/, '')
    .toLowerCase()
}

// A message saying what's wrong with one normalized tag, or null when it's fine.
export function noteTagProblem(tag) {
  if (tag.length > NOTE_TAG_LIMITS.tag) return TOO_LONG
  if (!ALLOWED.test(tag) || !HAS_WORD.test(tag)) return NOTE_TAG_CHARS
  return null
}

// A list of typed tags: { tags } normalized, empties dropped, no repeats; or { problem } in English.
export function parseNoteTags(list) {
  if (!Array.isArray(list) || list.some((tag) => typeof tag !== 'string')) return { problem: 'Invalid request.' }
  const tags = [...new Set(list.map(normalizeTag).filter(Boolean))]
  if (tags.length > NOTE_TAG_LIMITS.tags) return { problem: TOO_MANY }
  const problem = tags.map(noteTagProblem).find(Boolean)
  return problem ? { problem } : { tags }
}

// A note carries every one of the selected tags (several selected = AND).
export const hasAllTags = (note, selected) => selected.every((tag) => (note.tags ?? []).includes(tag))

// Every tag on these notes with how many carry it: most used first, then A to Z.
export function tagCounts(notes) {
  const counts = new Map()
  for (const note of notes) for (const tag of note.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}
