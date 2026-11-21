const toPosition = (row) => row && { world: row.world, x: row.x, y: row.y, updatedAt: row.updated_at }

function unwrap({ data, error }) {
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

// Where each player left their Glitch World hero (table world_positions). Spread into createSupabaseStore.
export function createSupabaseWorld(db) {
  return {
    async getWorldPosition(userId) {
      return toPosition(unwrap(await db.from('world_positions').select('*').eq('user_id', userId).maybeSingle()))
    },

    async saveWorldPosition(userId, { world, x, y }) {
      const row = { user_id: userId, world, x, y, updated_at: new Date().toISOString() }
      return toPosition(unwrap(await db.from('world_positions').upsert(row, { onConflict: 'user_id' }).select().single()))
    },
  }
}
