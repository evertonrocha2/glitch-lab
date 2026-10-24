// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NOTE_FOLDER_LIMITS } from '../../shared/note-folders.js'
import { api, useTempStore } from './helpers.js'

let store

beforeEach(async () => {
  store = await useTempStore()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

const make = async (name, token) => api('/api/note-folders', { body: { name }, token })
const folderOf = async (res) => (await res.json()).folder
const list = async (token) => (await (await api('/api/note-folders', { method: 'GET', token })).json()).folders
const patch = (id, body, token) => api(`/api/note-folders/${encodeURIComponent(id)}`, { method: 'PATCH', body, token })
const moveNote = (id, folderId, token) => api(`/api/notes/${encodeURIComponent(id)}`, { method: 'PATCH', body: { folderId }, token })

it('asks for sign in', async () => {
  expect((await api('/api/note-folders', { method: 'GET', token: null })).status).toBe(401)
  expect((await make('Work', null)).status).toBe(401)
  expect((await patch('x', { name: 'y' }, null)).status).toBe(401)
  expect((await api('/api/note-folders/x', { method: 'DELETE', token: null })).status).toBe(401)
})

it('creates folders at the end of the list, trimmed, and lists only mine', async () => {
  const res = await make('  Estudos   de JS ')
  expect(res.status).toBe(201)
  expect(await folderOf(res)).toMatchObject({ name: 'Estudos de JS', position: 0 })
  expect(await folderOf(await make('Trabalho'))).toMatchObject({ position: 1 })
  await make('Bob stuff', 'dev:bob')
  expect((await list()).map((folder) => folder.name)).toEqual(['Estudos de JS', 'Trabalho'])
  expect((await list('dev:bob')).map((folder) => folder.name)).toEqual(['Bob stuff'])
})

it('checks the name: present, 40 characters at most, unique ignoring case', async () => {
  for (const body of [{}, { name: '' }, { name: '    ' }, { name: 42 }]) {
    const res = await api('/api/note-folders', { body })
    expect(res.status).toBe(400)
  }
  expect((await (await make('   ')).json()).message).toBe('Give the folder a name.')
  const long = await make('a'.repeat(NOTE_FOLDER_LIMITS.name + 1))
  expect(long.status).toBe(400)
  expect((await long.json()).message).toBe('Keep the folder name up to 40 characters.')
  expect((await make('a'.repeat(NOTE_FOLDER_LIMITS.name))).status).toBe(201)

  await make('Loops')
  const again = await make('LOOPS')
  expect(again.status).toBe(409)
  expect((await again.json()).message).toBe('You already have a folder with that name.')
})

it('stops at 30 folders', async () => {
  for (let index = 0; index < NOTE_FOLDER_LIMITS.folders; index++) await store.createNoteFolder('alice', { name: `F${index}`, position: index })
  const res = await make('One more')
  expect(res.status).toBe(409)
  expect((await res.json()).message).toBe('You have 30 folders. Delete one to make another.')
})

it('renames a folder, and nobody else can', async () => {
  const folder = await folderOf(await make('Work'))
  await make('Study')
  const res = await patch(folder.id, { name: 'Trabalho' })
  expect(res.status).toBe(200)
  expect(await folderOf(res)).toMatchObject({ id: folder.id, name: 'Trabalho' })
  expect((await patch(folder.id, { name: 'study' })).status).toBe(409)
  expect((await patch(folder.id, { name: '' })).status).toBe(400)
  expect((await patch(folder.id, { name: 'Mine' }, 'dev:bob')).status).toBe(404)
  expect((await patch('nope', { name: 'x' })).status).toBe(404)
  expect((await list()).map((item) => item.name)).toEqual(['Trabalho', 'Study'])
})

it('moves a folder up and down the list', async () => {
  const [a, b, c] = [await folderOf(await make('A')), await folderOf(await make('B')), await folderOf(await make('C'))]
  const res = await patch(c.id, { position: 0 })
  expect(await folderOf(res)).toMatchObject({ id: c.id, position: 0 })
  expect((await list()).map((item) => item.name)).toEqual(['C', 'A', 'B'])
  await patch(c.id, { position: 99 })
  expect((await list()).map((item) => item.name)).toEqual(['A', 'B', 'C'])
  await patch(a.id, { position: 1 })
  expect((await list()).map((item) => [item.name, item.position])).toEqual([
    ['B', 0],
    ['A', 1],
    ['C', 2],
  ])
  for (const position of [-1, 1.5, '2', null]) expect((await patch(b.id, { position })).status).toBe(400)
})

it('deletes a folder and keeps its notes, now outside every folder', async () => {
  const folder = await folderOf(await make('Work'))
  const note = await store.createNote('alice', { title: 'Inside', blocks: [], folderId: folder.id })
  expect((await api(`/api/note-folders/${folder.id}`, { method: 'DELETE', token: 'dev:bob' })).status).toBe(404)
  const res = await api(`/api/note-folders/${folder.id}`, { method: 'DELETE' })
  expect(res.status).toBe(200)
  expect(await list()).toEqual([])
  const notes = (await (await api('/api/notes', { method: 'GET' })).json()).notes
  expect(notes).toEqual([expect.objectContaining({ id: note.id, title: 'Inside', folderId: null })])
  expect((await api(`/api/note-folders/${folder.id}`, { method: 'DELETE' })).status).toBe(404)
})

it('moves a note into one of my folders and back out, never into someone else’s', async () => {
  const folder = await folderOf(await make('Work'))
  const bobs = await folderOf(await make('Bob', 'dev:bob'))
  const note = await store.createNote('alice', { title: 'Mine', blocks: [] })

  const moved = await moveNote(note.id, folder.id)
  expect(moved.status).toBe(200)
  expect((await moved.json()).note).toMatchObject({ id: note.id, folderId: folder.id, title: 'Mine' })

  const theirs = await moveNote(note.id, bobs.id)
  expect(theirs.status).toBe(404)
  expect((await theirs.json()).message).toBe('Folder not found.')
  expect((await moveNote(note.id, 'nope')).status).toBe(404)
  for (const folderId of [42, '', 'x'.repeat(65)]) expect((await moveNote(note.id, folderId)).status).toBe(400)

  expect((await (await moveNote(note.id, null)).json()).note.folderId).toBeNull()
})

it('creates a note straight into a folder', async () => {
  const folder = await folderOf(await make('Work'))
  const res = await api('/api/notes', { body: { title: 'New', folderId: folder.id } })
  expect((await res.json()).note.folderId).toBe(folder.id)
  const bobs = await folderOf(await make('Bob', 'dev:bob'))
  expect((await api('/api/notes', { body: { title: 'New', folderId: bobs.id } })).status).toBe(404)
})

it('never shows the folder on a public note', async () => {
  const ada = await store.createUser({ email: 'ada@example.com', passwordHash: null, isDemo: false })
  await store.updateProfile(ada.id, { handle: 'alice_dev', displayName: 'Ada', isPublic: true })
  const folder = (await store.createNoteFolder(ada.id, { name: 'Secret plans', position: 0 })).folder
  const note = await store.createNote(ada.id, { title: 'Shared', blocks: [], isPublic: true, folderId: folder.id })
  const listed = await (await api('/api/profiles/alice_dev/notes', { method: 'GET', token: null })).json()
  const one = await (await api(`/api/profiles/alice_dev/notes/${note.id}`, { method: 'GET', token: null })).json()
  expect(JSON.stringify(listed)).not.toContain(folder.id)
  expect(JSON.stringify(one)).not.toContain(folder.id)
  expect(listed.notes[0]).not.toHaveProperty('folderId')
  expect(one.note).not.toHaveProperty('folderId')
})
