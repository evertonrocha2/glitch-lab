import * as notes from './notes.service.js'

// Short, so a note taken back down disappears quickly.
const PUBLIC_CACHE = 'public, s-maxage=15'

export async function list(req, res) {
  res.json({ notes: await notes.listNotes(req.deps.store, req.user) })
}

export async function create(req, res) {
  res.status(201).json({ note: await notes.createNote(req.deps.store, req.user, req.body) })
}

export async function update(req, res) {
  res.json({ note: await notes.updateNote(req.deps.store, req.user, req.params.id, req.body) })
}

export async function remove(req, res) {
  await notes.deleteNote(req.deps.store, req.user, req.params.id)
  res.json({ deleted: true })
}

export async function listPublic(req, res) {
  const list = await notes.listPublicNotes(req.deps.store, req.params.handle)
  res.set('Cache-Control', PUBLIC_CACHE).json({ notes: list })
}

export async function getPublic(req, res) {
  const found = await notes.getPublicNote(req.deps.store, req.params.handle, req.params.id)
  res.set('Cache-Control', PUBLIC_CACHE).json(found)
}
