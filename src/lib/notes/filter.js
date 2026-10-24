import { NO_FOLDER } from '../../../shared/note-folders.js'
import { hasAllTags, normalizeTag } from '../../../shared/note-tags.js'

// The notes list filters live in the address (?folder=id|none&tag=a&tag=b&q=...), so a reload keeps them.
// folder: a folder id, NO_FOLDER for the notes outside every folder, or null for all of them.
export function readFilters(params) {
  const tags = [...new Set(params.getAll('tag').map(normalizeTag).filter(Boolean))]
  return { folder: params.get('folder') || null, tags, query: params.get('q') ?? '' }
}

// The address for a set of filters, in a fixed order.
export function filterParams({ folder, tags, query }) {
  const next = new URLSearchParams()
  if (folder) next.set('folder', folder)
  for (const tag of tags) next.append('tag', tag)
  if (query) next.set('q', query)
  return next
}

// The search looks in the title, the writing and the tags.
export function matchesQuery(note, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const words = [note.title, ...note.blocks.map((block) => block.text), ...(note.tags ?? [])]
  return words.some((value) => (value ?? '').toLowerCase().includes(needle))
}

// known: the ids of my folders. A note whose folder is gone counts as outside every folder.
export function inFolder(note, folder, known) {
  if (!folder) return true
  const own = note.folderId && known.has(note.folderId) ? note.folderId : null
  return folder === NO_FOLDER ? own === null : own === folder
}

export const filterNotes = (notes, { folder = null, tags, query }, known = new Set()) =>
  notes.filter((note) => inFolder(note, folder, known) && hasAllTags(note, tags) && matchesQuery(note, query))
