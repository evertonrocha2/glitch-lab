import { NOTE_LIMITS } from '../shared/limits.js'
import { handleProblem, normalizeHandle } from '../shared/profile.js'
import { fail, ok, readJson, requireUser } from './_lib/http.js'
import { parseNote, publicNote, publicNoteSummary } from './_lib/notes.js'
import { profileCard } from './_lib/profile.js'
import { getStore } from './_lib/store/index.js'

// One read of the author's cases, however many case blocks the note has (the page is public).
async function authorCases(store, userId) {
  const byId = new Map((await store.listCases(userId)).map((kase) => [kase.id, kase]))
  return (caseId) => byId.get(caseId) ?? null
}

const NOT_SHARED = 'No public note here.'
const DEMO_SHARE = 'Sign up to share notes on a public profile.'

// Public notes: only when the note AND its owner's profile are public. Anyone can read them.
// GET ?handle=xyz lists them; GET ?handle=xyz&id=... opens one, read-only.
async function getPublic(params) {
  const handle = normalizeHandle(params.get('handle'))
  if (handleProblem(handle)) return fail(404, NOT_SHARED)
  const store = getStore()
  const found = await store.findPublicProfile(handle)
  if (!found) return fail(404, NOT_SHARED)

  let response
  if (params.has('id')) {
    const id = params.get('id')
    const note = id.length <= 64 ? await store.getNote(found.userId, id) : null
    if (!note?.isPublic) return fail(404, NOT_SHARED)
    response = ok({
      note: await publicNote(note, await authorCases(store, found.userId)),
      author: profileCard(found.profile, found.userId),
    })
  } else {
    const notes = await store.listNotes(found.userId)
    response = ok({ notes: notes.filter((note) => note.isPublic).map(publicNoteSummary) })
  }
  // Short, so a note taken back down disappears quickly.
  response.headers.set('Cache-Control', 'public, s-maxage=15')
  return response
}

export async function GET(request) {
  const params = new URL(request.url).searchParams
  if (params.has('handle')) return getPublic(params)

  const auth = await requireUser(request)
  if (auth.response) return auth.response
  return ok({ notes: await getStore().listNotes(auth.user.id) })
}

export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const parsed = parseNote((await readJson(request)) ?? {})
  if (!parsed.value) return fail(parsed.status, parsed.message)
  // Demo accounts are throwaway: they never publish anything.
  if (auth.user.isDemo && parsed.value.isPublic) return fail(403, DEMO_SHARE)

  const store = getStore()
  if ((await store.listNotes(auth.user.id)).length >= NOTE_LIMITS.notes) {
    return fail(409, `You have ${NOTE_LIMITS.notes} notes. Delete one to write another.`)
  }
  const note = await store.createNote(auth.user.id, { title: '', blocks: [], ...parsed.value })
  return ok({ note }, 201)
}

export async function PUT(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = await readJson(request)
  if (typeof body?.id !== 'string') return fail(400, 'Invalid request.')
  const parsed = parseNote(body)
  if (!parsed.value) return fail(parsed.status, parsed.message)
  if (auth.user.isDemo && parsed.value.isPublic) return fail(403, DEMO_SHARE)

  const note = await getStore().updateNote(auth.user.id, body.id, parsed.value)
  return note ? ok({ note }) : fail(404, 'Note not found.')
}

export async function DELETE(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return fail(400, 'Invalid request.')
  return (await getStore().deleteNote(auth.user.id, id)) ? ok({ deleted: true }) : fail(404, 'Note not found.')
}
