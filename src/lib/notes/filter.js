import { hasAllTags, normalizeTag } from '../../../shared/note-tags.js'

// The notes list filters live in the address (?tag=a&tag=b&q=...), so a reload keeps them.
export function readFilters(params) {
  const tags = [...new Set(params.getAll('tag').map(normalizeTag).filter(Boolean))]
  return { tags, query: params.get('q') ?? '' }
}

// The search looks in the title, the writing and the tags.
export function matchesQuery(note, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const words = [note.title, ...note.blocks.map((block) => block.text), ...(note.tags ?? [])]
  return words.some((value) => (value ?? '').toLowerCase().includes(needle))
}

export const filterNotes = (notes, { tags, query }) => notes.filter((note) => hasAllTags(note, tags) && matchesQuery(note, query))
