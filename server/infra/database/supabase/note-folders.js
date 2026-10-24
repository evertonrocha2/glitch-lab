// Postgres "invalid input syntax for type uuid": a malformed id simply matches nothing.
const INVALID_UUID = '22P02'
// Postgres unique_violation: the (user_id, lower(name)) index, another folder has that name.
const UNIQUE_VIOLATION = '23505'

// Timestamps as ISO strings with milliseconds, the same shape the local store keeps.
const iso = (value) => (value == null ? null : new Date(value).toISOString())

const toFolder = (row) =>
  row && { id: row.id, name: row.name, position: row.position, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) }

function unwrap({ data, error }) {
  if (error?.code === INVALID_UUID) return null
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

const defined = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined))

// Note folders on Supabase (note_folders). Spread into createSupabaseStore. Deleting one leaves its
// notes outside every folder through notes.folder_id's "on delete set null".
export function createSupabaseNoteFolders(db) {
  const table = () => db.from('note_folders')

  return {
    async listNoteFolders(userId) {
      const rows = unwrap(await table().select('*').eq('user_id', userId).order('position').order('created_at'))
      return (rows ?? []).map(toFolder)
    },

    async createNoteFolder(userId, { name, position = 0 }) {
      const result = await table().insert({ user_id: userId, name, position }).select().single()
      if (result.error?.code === UNIQUE_VIOLATION) return { conflict: 'name' }
      return { folder: toFolder(unwrap(result)) }
    },

    async updateNoteFolder(userId, id, { name, position }) {
      const patch = defined({ name, position, updated_at: new Date().toISOString() })
      const result = await table().update(patch).eq('id', id).eq('user_id', userId).select().maybeSingle()
      if (result.error?.code === UNIQUE_VIOLATION) return { conflict: 'name' }
      const row = unwrap(result)
      return row ? { folder: toFolder(row) } : null
    },

    async deleteNoteFolder(userId, id) {
      const rows = unwrap(await table().delete().eq('id', id).eq('user_id', userId).select('id'))
      return (rows ?? []).length > 0
    },
  }
}
