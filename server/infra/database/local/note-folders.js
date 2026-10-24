import { randomUUID } from 'node:crypto'

const now = () => new Date().toISOString()
const copy = (value) => structuredClone(value)
const toFolder = ({ userId, ...folder }) => copy(folder)

// Note folders in the local JSON file. Spread into createLocalStore. Names are unique per account
// ignoring case, like the unique index on (user_id, lower(name)) in Postgres.
export function createLocalNoteFolders({ load, save }) {
  // Files saved before folders existed don't have the list yet.
  const foldersOf = (data) => (data.noteFolders ??= [])
  const own = (data, userId) => foldersOf(data).filter((folder) => folder.userId === userId)
  const taken = (data, userId, name, exceptId) =>
    own(data, userId).some((folder) => folder.id !== exceptId && folder.name.toLowerCase() === name.toLowerCase())

  return {
    // By position, then oldest first.
    async listNoteFolders(userId) {
      const data = await load()
      return own(data, userId)
        .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
        .map(toFolder)
    },

    // { folder }, or { conflict: 'name' } when another of my folders has that name.
    async createNoteFolder(userId, { name, position = 0 }) {
      const data = await load()
      if (taken(data, userId, name)) return { conflict: 'name' }
      const stamp = now()
      const folder = { id: randomUUID(), userId, name, position, createdAt: stamp, updatedAt: stamp }
      foldersOf(data).push(folder)
      await save()
      return { folder: toFolder(folder) }
    },

    // name and position: only the fields given change. { folder }, { conflict: 'name' }, or null.
    async updateNoteFolder(userId, id, { name, position }) {
      const data = await load()
      const found = foldersOf(data).find((folder) => folder.id === id && folder.userId === userId)
      if (!found) return null
      if (name !== undefined && taken(data, userId, name, id)) return { conflict: 'name' }
      if (name !== undefined) found.name = name
      if (position !== undefined) found.position = position
      found.updatedAt = now()
      await save()
      return { folder: toFolder(found) }
    },

    // The notes inside stay, outside every folder ("on delete set null").
    async deleteNoteFolder(userId, id) {
      const data = await load()
      const list = foldersOf(data)
      const index = list.findIndex((folder) => folder.id === id && folder.userId === userId)
      if (index === -1) return false
      list.splice(index, 1)
      for (const note of data.notes ?? []) if (note.folderId === id) note.folderId = null
      await save()
      return true
    },
  }
}
