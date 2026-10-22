// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DELETE, GET, POST, PUT } from '../../api/notes.js'
import { NOTE_LIMITS } from '../../shared/limits.js'
import { apiRequest, useTempStore } from './helpers.js'

let store

beforeEach(async () => {
  store = await useTempStore()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

const BLOCKS = [
  { id: 'b1', type: 'heading', text: 'Undefined again' },
  { id: 'b2', type: 'text', text: 'I keep reading properties too early.' },
  { id: 'b3', type: 'todo', text: 'Use ?. next time', done: false },
  { id: 'b4', type: 'case', caseId: 'c1' },
]

const create = (body, token) => POST(apiRequest('/api/notes', { body, token }))

it('creates a note and lists it', async () => {
  const res = await create({ title: 'My notes', blocks: BLOCKS })
  expect(res.status).toBe(201)
  const { note } = await res.json()
  expect(note).toMatchObject({ title: 'My notes', blocks: BLOCKS })

  const list = await GET(apiRequest('/api/notes', { method: 'GET' }))
  expect((await list.json()).notes.map((item) => item.id)).toEqual([note.id])
})

it('drops fields a block should not have', async () => {
  const res = await create({ title: 'x', blocks: [{ id: 'b1', type: 'text', text: 'hi', html: '<script>' }] })
  expect((await res.json()).note.blocks).toEqual([{ id: 'b1', type: 'text', text: 'hi' }])
})

it('starts an empty note when nothing is sent', async () => {
  const res = await create({})
  expect((await res.json()).note).toMatchObject({ title: '', blocks: [] })
})

it('refuses broken blocks and oversized notes', async () => {
  for (const blocks of [
    [{ id: 'b1', type: 'video', url: 'x' }],
    [{ id: 'b1', type: 'text', text: 42 }],
    [{ id: 'b1', type: 'todo', text: 'x', done: 'yes' }],
    [{ id: 'b1', type: 'case' }],
    'not a list',
  ]) {
    const res = await create({ title: 'x', blocks })
    expect(res.status).toBe(400)
  }
  const longText = await create({ blocks: [{ id: 'b1', type: 'text', text: 'a'.repeat(NOTE_LIMITS.text + 1) }] })
  expect(longText.status).toBe(413)
  const tooMany = await create({ blocks: Array.from({ length: NOTE_LIMITS.blocks + 1 }, (_, i) => ({ id: `b${i}`, type: 'text', text: '' })) })
  expect(tooMany.status).toBe(413)
  const longTitle = await create({ title: 'a'.repeat(NOTE_LIMITS.title + 1) })
  expect(longTitle.status).toBe(413)
})

it('stops at the note limit', async () => {
  vi.spyOn(store, 'listNotes').mockResolvedValue(Array.from({ length: NOTE_LIMITS.notes }, (_, i) => ({ id: `n${i}` })))
  const res = await create({ title: 'one more' })
  expect(res.status).toBe(409)
})

it('updates my note and nobody else can', async () => {
  const { note } = await (await create({ title: 'Draft', blocks: [] })).json()
  const theirs = await PUT(apiRequest('/api/notes', { method: 'PUT', body: { id: note.id, title: 'Mine' }, token: 'dev:bob' }))
  expect(theirs.status).toBe(404)

  const res = await PUT(apiRequest('/api/notes', { method: 'PUT', body: { id: note.id, title: 'Final', blocks: BLOCKS } }))
  expect(res.status).toBe(200)
  expect((await res.json()).note).toMatchObject({ id: note.id, title: 'Final', blocks: BLOCKS })
})

it('deletes my note', async () => {
  const { note } = await (await create({ title: 'Bye' })).json()
  const theirs = await DELETE(apiRequest(`/api/notes?id=${note.id}`, { method: 'DELETE', token: 'dev:bob' }))
  expect(theirs.status).toBe(404)
  const res = await DELETE(apiRequest(`/api/notes?id=${note.id}`, { method: 'DELETE' }))
  expect(res.status).toBe(200)
  expect(await store.getNote('alice', note.id)).toBeNull()
})

it('asks for sign in', async () => {
  expect((await GET(apiRequest('/api/notes', { method: 'GET', token: null }))).status).toBe(401)
  expect((await create({ title: 'x' }, null)).status).toBe(401)
})
