import { expect, it } from 'vitest'

// Note folders: every store must pass these. storeContract calls this inside its describe, with a
// getter for the store and the test users' ids (fresh accounts on Supabase).
export function noteFoldersStoreContract(getStore, ids) {
  it('creates, lists in order, renames, moves and deletes note folders, only my own', async () => {
    const store = getStore()
    const { folder: work } = await store.createNoteFolder(ids.alice, { name: 'Work', position: 0 })
    expect(work).toMatchObject({ name: 'Work', position: 0 })
    expect(work.id).toEqual(expect.any(String))
    expect(work.createdAt).toEqual(expect.any(String))
    expect(work).not.toHaveProperty('userId')
    const { folder: study } = await store.createNoteFolder(ids.alice, { name: 'Study', position: 1 })
    await store.createNoteFolder(ids.bob, { name: 'Work', position: 0 })

    expect((await store.listNoteFolders(ids.alice)).map((folder) => folder.name)).toEqual(['Work', 'Study'])
    expect((await store.listNoteFolders(ids.bob)).map((folder) => folder.name)).toEqual(['Work'])

    const renamed = await store.updateNoteFolder(ids.alice, study.id, { name: 'Estudos', position: 0 })
    expect(renamed.folder).toMatchObject({ id: study.id, name: 'Estudos', position: 0 })
    await store.updateNoteFolder(ids.alice, work.id, { position: 1 })
    expect((await store.listNoteFolders(ids.alice)).map((folder) => folder.name)).toEqual(['Estudos', 'Work'])

    expect(await store.updateNoteFolder(ids.bob, work.id, { name: 'Mine now' })).toBeNull()
    expect(await store.deleteNoteFolder(ids.bob, work.id)).toBe(false)
    expect(await store.deleteNoteFolder(ids.alice, work.id)).toBe(true)
    expect((await store.listNoteFolders(ids.alice)).map((folder) => folder.id)).toEqual([study.id])
  })

  it('keeps folder names unique per account, ignoring case', async () => {
    const store = getStore()
    const { folder } = await store.createNoteFolder(ids.alice, { name: 'Loops', position: 0 })
    expect(await store.createNoteFolder(ids.alice, { name: 'loops', position: 1 })).toEqual({ conflict: 'name' })
    const { folder: other } = await store.createNoteFolder(ids.alice, { name: 'Arrays', position: 1 })
    expect(await store.updateNoteFolder(ids.alice, other.id, { name: 'LOOPS' })).toEqual({ conflict: 'name' })
    // Renaming a folder to its own name in another case is fine.
    expect((await store.updateNoteFolder(ids.alice, folder.id, { name: 'LOOPS' })).folder.name).toBe('LOOPS')
    // Another account can use the same name.
    expect((await store.createNoteFolder(ids.bob, { name: 'Loops', position: 0 })).folder.name).toBe('Loops')
  })

  it('puts notes in folders without counting it as an edit, and keeps them when the folder goes', async () => {
    const store = getStore()
    const { folder } = await store.createNoteFolder(ids.alice, { name: 'JS', position: 0 })
    const loose = await store.createNoteFolder(ids.alice, { name: 'Loose', position: 1 })
    expect(loose.folder).toBeTruthy()
    const first = await store.createNote(ids.alice, { title: 'First', blocks: [] })
    expect(first.folderId).toBeNull()
    const second = await store.createNote(ids.alice, { title: 'Second', blocks: [], folderId: folder.id })
    expect(second.folderId).toBe(folder.id)
    expect((await store.getNote(ids.alice, second.id)).folderId).toBe(folder.id)

    const moved = await store.updateNote(ids.alice, first.id, { folderId: folder.id })
    expect(moved).toMatchObject({ id: first.id, title: 'First', folderId: folder.id, updatedAt: first.updatedAt })
    // Still where it was: "last edited first" doesn't change for a move.
    expect((await store.listNotes(ids.alice)).map((note) => note.id)).toEqual([second.id, first.id])
    // An edit keeps the folder.
    expect((await store.updateNote(ids.alice, first.id, { title: 'First!' })).folderId).toBe(folder.id)
    expect((await store.updateNote(ids.alice, first.id, { folderId: null })).folderId).toBeNull()

    expect(await store.deleteNoteFolder(ids.alice, folder.id)).toBe(true)
    const kept = await store.getNote(ids.alice, second.id)
    expect(kept).toMatchObject({ title: 'Second', folderId: null })
    expect((await store.listNotes(ids.alice)).every((note) => note.folderId === null)).toBe(true)
  })
}
