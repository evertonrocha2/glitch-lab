import { NOTE_LIMITS } from '../shared/limits.js'
import { fail, ok, readJson, requireUser } from './_lib/http.js'
import { parseNote } from './_lib/notes.js'
import { getStore } from './_lib/store/index.js'

export async function GET(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  return ok({ notes: await getStore().listNotes(auth.user.id) })
}

export async function POST(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const parsed = parseNote((await readJson(request)) ?? {})
  if (!parsed.value) return fail(parsed.status, parsed.message)

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
