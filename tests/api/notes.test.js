// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE, GET, POST, PUT } from '../../api/notes.js'
import { NOTE_LIMITS } from '../../shared/limits.js'
import { apiRequest, useTempStore } from './helpers.js'
import { CASE } from './store-contract.js'

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

const update = (body, token) => PUT(apiRequest('/api/notes', { method: 'PUT', body, token }))

it('keeps a note private until it is marked public', async () => {
  const { note } = await (await create({ title: 'Draft' })).json()
  expect(note.isPublic).toBe(false)
  const res = await update({ id: note.id, isPublic: true })
  expect(res.status).toBe(200)
  expect((await res.json()).note).toMatchObject({ title: 'Draft', isPublic: true })
  expect((await update({ id: note.id, isPublic: 'yes' })).status).toBe(400)
  expect((await update({ id: note.id, isPublic: false })).status).toBe(200)
})

it('never lets a demo account share a note', async () => {
  const { note } = await (await create({ title: 'Demo note' }, 'dev:demo')).json()
  expect((await update({ id: note.id, isPublic: true }, 'dev:demo')).status).toBe(403)
  expect((await create({ title: 'x', isPublic: true }, 'dev:demo')).status).toBe(403)
  expect((await update({ id: note.id, isPublic: false }, 'dev:demo')).status).toBe(200)
  expect((await store.getNote('demo', note.id)).isPublic).toBe(false)
})

describe('public notes', () => {
  const PUBLIC_CASE = {
    ...CASE,
    error: "TypeError: Cannot read properties of undefined (reading 'name')\n    at secretFile.js:12",
    code: 'const SECRET_TOKEN = "abc"; user.name',
    files: [{ path: 'src/secret.js', content: 'PRIVATE_FILE_CONTENT' }],
    context: 'PRIVATE_CONTEXT',
    analysis: { ...CASE.analysis, explicacao: 'PRIVATE_ANALYSIS', correcao: 'PRIVATE_FIX' },
  }
  let ada
  let adaCase
  let bobCase

  const listPublic = (handle) => GET(apiRequest(`/api/notes?handle=${encodeURIComponent(handle)}`, { method: 'GET', token: null }))
  const readPublic = (handle, id) =>
    GET(apiRequest(`/api/notes?handle=${encodeURIComponent(handle)}&id=${encodeURIComponent(id)}`, { method: 'GET', token: null }))
  const adaNote = (fields) => store.createNote(ada.id, { title: '', blocks: [], ...fields })

  beforeEach(async () => {
    ada = await store.createUser({ email: 'ada@example.com', passwordHash: null, isDemo: false })
    await store.updateProfile(ada.id, { handle: 'ada_dev', displayName: 'Ada', isPublic: true, headline: 'Learning React' })
    adaCase = await store.createCase(ada.id, PUBLIC_CASE)
    await store.updateCase(ada.id, adaCase.id, { status: 'solved' })
    bobCase = await store.createCase('bob', { ...CASE, error: 'BobError: bob only' })
  })

  it('lists only the public notes of a public profile, signed out', async () => {
    const shared = await adaNote({
      title: 'Reading undefined',
      isPublic: true,
      blocks: [
        { id: 'b1', type: 'heading', text: 'What I learned' },
        { id: 'b2', type: 'text', text: `Check the object first. ${'More words. '.repeat(30)}` },
        { id: 'b3', type: 'case', caseId: adaCase.id },
      ],
    })
    await adaNote({ title: 'Secret diary', blocks: [{ id: 'b1', type: 'text', text: 'private thoughts' }] })

    const res = await listPublic('ADA_DEV')
    expect(res.status).toBe(200)
    const { notes } = await res.json()
    expect(notes).toHaveLength(1)
    expect(notes[0]).toEqual({ id: shared.id, title: 'Reading undefined', updatedAt: shared.updatedAt, excerpt: expect.any(String), blockCount: 3 })
    expect(notes[0].excerpt.startsWith('What I learned Check the object first.')).toBe(true)
    expect(notes[0].excerpt.length).toBeLessThanOrEqual(160)
    const text = JSON.stringify(notes)
    for (const secret of ['Secret diary', 'private thoughts', ada.id, adaCase.id]) expect(text).not.toContain(secret)
  })

  it('shows one public note read-only, with a safe summary of each case', async () => {
    const note = await adaNote({
      title: 'Reading undefined',
      isPublic: true,
      blocks: [
        { id: 'b1', type: 'text', text: 'Check first.' },
        { id: 'b2', type: 'todo', text: 'Use ?.', done: true },
        { id: 'b3', type: 'case', caseId: adaCase.id },
        { id: 'b4', type: 'case', caseId: bobCase.id },
        { id: 'b5', type: 'case', caseId: 'gone' },
      ],
    })
    const res = await readPublic('ada_dev', note.id)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.note).toEqual({
      id: note.id,
      title: 'Reading undefined',
      updatedAt: note.updatedAt,
      blocks: [
        { id: 'b1', type: 'text', text: 'Check first.' },
        { id: 'b2', type: 'todo', text: 'Use ?.', done: true },
        {
          id: 'b3',
          type: 'case',
          case: {
            errorType: 'TypeError',
            message: "Cannot read properties of undefined (reading 'name')",
            bugType: 'Reading undefined',
            language: 'javascript',
            status: 'solved',
          },
        },
        // Someone else's case, or one that is gone: nothing about it is shown.
        { id: 'b4', type: 'case', case: null },
        { id: 'b5', type: 'case', case: null },
      ],
    })
    expect(body.author).toMatchObject({ handle: 'ada_dev', displayName: 'Ada', headline: 'Learning React' })

    const text = JSON.stringify(body)
    for (const secret of [
      'SECRET_TOKEN',
      'PRIVATE_FILE_CONTENT',
      'src/secret.js',
      'PRIVATE_CONTEXT',
      'secretFile.js',
      'PRIVATE_ANALYSIS',
      'PRIVATE_FIX',
      'BobError',
      adaCase.id,
      bobCase.id,
      ada.id,
      'ada@example.com',
    ]) {
      expect(text, secret).not.toContain(secret)
    }
  })

  it('hides private notes, notes of private profiles and notes of other people', async () => {
    const hidden = await adaNote({ title: 'Hidden', isPublic: false })
    const shared = await adaNote({ title: 'Shared', isPublic: true })
    const bob = await store.createUser({ email: 'bob@example.com', passwordHash: null, isDemo: false })
    await store.updateProfile(bob.id, { handle: 'bob_dev', isPublic: true })
    const bobs = await store.createNote(bob.id, { title: 'Bob public', blocks: [], isPublic: true })

    expect((await readPublic('ada_dev', hidden.id)).status).toBe(404)
    expect((await readPublic('ada_dev', bobs.id)).status).toBe(404)
    expect((await readPublic('ada_dev', 'missing')).status).toBe(404)
    expect((await readPublic('ada_dev', shared.id)).status).toBe(200)

    // The profile goes private: every note goes dark with it.
    await store.updateProfile(ada.id, { isPublic: false })
    expect((await readPublic('ada_dev', shared.id)).status).toBe(404)
    expect((await listPublic('ada_dev')).status).toBe(404)
  })

  it('answers 404 for a missing or malformed handle', async () => {
    for (const handle of ['nobody', '../etc', '']) expect((await listPublic(handle)).status, handle).toBe(404)
    expect((await readPublic('ada_dev', 'x'.repeat(65))).status).toBe(404)
  })

  it('never shows a demo note, even one marked public', async () => {
    const demo = await store.createUser({ email: 'demo-1@demo.glitch', passwordHash: null, isDemo: true })
    await store.createNote(demo.id, { title: 'Seeded', blocks: [], isPublic: true })
    // A demo profile can't go public through the API, so its handle never resolves.
    expect((await listPublic('demo')).status).toBe(404)
  })
})
