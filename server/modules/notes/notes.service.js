import { NOTE_LIMITS } from '../../../shared/limits.js'
import { normalizeTag, NOTE_TAG_LIMITS, noteTagProblem } from '../../../shared/note-tags.js'
import { handleProblem, normalizeHandle } from '../../../shared/profile.js'
import { badRequest, conflict, forbidden, notFound, valueOrThrow } from '../../core/errors.js'
import { profileCard } from '../profile/profile.model.js'
import { parseNote, publicNote, publicNoteSummary } from './notes.model.js'

const NOT_SHARED = 'No public note here.'
const DEMO_SHARE = 'Sign up to share notes on a public profile.'
const NOTE_NOT_FOUND = 'Note not found.'

// One read of the author's cases, however many case blocks the note has (the page is public).
async function authorCases(store, userId) {
  const byId = new Map((await store.listCases(userId)).map((kase) => [kase.id, kase]))
  return (caseId) => byId.get(caseId) ?? null
}

// tag: one string or a list (?tag=a&tag=b), the notes carrying all of them. A tag that can't exist
// matches nothing, without asking the store.
export async function listNotes(store, user, tag) {
  const tags = [...new Set((Array.isArray(tag) ? tag : tag === undefined ? [] : [tag]).map((value) => normalizeTag(String(value))).filter(Boolean))]
  if (tags.length > NOTE_TAG_LIMITS.tags || tags.some(noteTagProblem)) return []
  return store.listNotes(user.id, tags.length ? { tags } : undefined)
}

export async function createNote(store, user, body) {
  const value = valueOrThrow(parseNote(body ?? {}))
  // Demo accounts are throwaway: they never publish anything.
  if (user.isDemo && value.isPublic) throw forbidden(DEMO_SHARE)
  if ((await store.listNotes(user.id)).length >= NOTE_LIMITS.notes) {
    throw conflict(`You have ${NOTE_LIMITS.notes} notes. Delete one to write another.`)
  }
  return store.createNote(user.id, { title: '', blocks: [], tags: [], ...value })
}

// Title, blocks, tags and isPublic: only the fields sent change.
export async function updateNote(store, user, id, body) {
  if (!body) throw badRequest()
  const value = valueOrThrow(parseNote(body))
  if (user.isDemo && value.isPublic) throw forbidden(DEMO_SHARE)
  const note = await store.updateNote(user.id, id, value)
  if (!note) throw notFound(NOTE_NOT_FOUND)
  return note
}

export async function deleteNote(store, user, id) {
  if (!(await store.deleteNote(user.id, id))) throw notFound(NOTE_NOT_FOUND)
}

// Public notes: only when the note AND its owner's profile are public. Anyone can read them.
async function publicAuthor(store, rawHandle) {
  const handle = normalizeHandle(rawHandle)
  if (handleProblem(handle)) throw notFound(NOT_SHARED)
  const found = await store.findPublicProfile(handle)
  if (!found) throw notFound(NOT_SHARED)
  return found
}

export async function listPublicNotes(store, handle) {
  const found = await publicAuthor(store, handle)
  const notes = await store.listNotes(found.userId)
  return notes.filter((note) => note.isPublic).map(publicNoteSummary)
}

// One shared note, read-only, with its author's card.
export async function getPublicNote(store, handle, id) {
  const found = await publicAuthor(store, handle)
  const note = id.length <= 64 ? await store.getNote(found.userId, id) : null
  if (!note?.isPublic) throw notFound(NOT_SHARED)
  return { note: await publicNote(note, await authorCases(store, found.userId)), author: profileCard(found.profile, found.userId) }
}
