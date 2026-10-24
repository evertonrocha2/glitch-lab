// Note folders: private groups for the notes list. Rules shared by the API (which enforces them) and
// the folder column (which checks them as you type). folders: per account, name: characters.
export const NOTE_FOLDER_LIMITS = { folders: 30, name: 40 }

export const FOLDER_NAME_EMPTY = 'Give the folder a name.'
export const FOLDER_NAME_LONG = `Keep the folder name up to ${NOTE_FOLDER_LIMITS.name} characters.`
export const FOLDER_NAME_TAKEN = 'You already have a folder with that name.'
export const TOO_MANY_FOLDERS = `You have ${NOTE_FOLDER_LIMITS.folders} folders. Delete one to make another.`

// The address says ?folder=none for the notes outside every folder.
export const NO_FOLDER = 'none'

// "  Estudos   de  JS " -> "Estudos de JS". Case stays as typed; two names that only differ in case
// are the same folder (the database checks lower(name)).
export const normalizeFolderName = (text) => String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()

// An English message saying what's wrong with a normalized name, or null when it's fine.
export function folderNameProblem(name) {
  if (!name) return FOLDER_NAME_EMPTY
  if (name.length > NOTE_FOLDER_LIMITS.name) return FOLDER_NAME_LONG
  return null
}

export const sameFolderName = (a, b) => a.toLowerCase() === b.toLowerCase()

// How many notes sit in each folder, and outside all of them. A note whose folder is gone counts as
// outside, like "on delete set null" would leave it.
export function folderCounts(notes, folders) {
  const known = new Set(folders.map((folder) => folder.id))
  const byFolder = new Map(folders.map((folder) => [folder.id, 0]))
  let none = 0
  for (const note of notes) {
    if (note.folderId && known.has(note.folderId)) byFolder.set(note.folderId, byFolder.get(note.folderId) + 1)
    else none += 1
  }
  return { all: notes.length, none, byFolder }
}

// The folders in a new order: the one with this id moved to index `to` (clamped to the list).
export function moveFolder(folders, id, to) {
  const from = folders.findIndex((folder) => folder.id === id)
  if (from === -1) return folders
  const target = Math.max(0, Math.min(to, folders.length - 1))
  if (target === from) return folders
  const next = [...folders]
  const [moved] = next.splice(from, 1)
  next.splice(target, 0, moved)
  return next
}
