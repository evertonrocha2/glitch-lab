const toHero = (row) => row && { version: row.version, data: row.data, updatedAt: row.updated_at }

function unwrap({ data, error }) {
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

// Glitch World v2 heroes (table game_heroes): one jsonb document per player, saved under a version check.
// Spread into createSupabaseStore.
export function createSupabaseGame(db) {
  return {
    async getGameHero(userId) {
      return toHero(unwrap(await db.from('game_heroes').select('*').eq('user_id', userId).maybeSingle()))
    },

    async saveGameHero(userId, hero, expectedVersion) {
      const updatedAt = new Date().toISOString()
      if (expectedVersion === 0) {
        const { data, error } = await db
          .from('game_heroes')
          .insert({ user_id: userId, version: 1, data: hero, updated_at: updatedAt })
          .select()
          .single()
        // A row already exists: someone saved first.
        if (error?.code === '23505') return null
        if (error) throw new Error(`Supabase: ${error.message}`)
        return toHero(data)
      }
      const rows = unwrap(
        await db
          .from('game_heroes')
          .update({ version: expectedVersion + 1, data: hero, updated_at: updatedAt })
          .eq('user_id', userId)
          .eq('version', expectedVersion)
          .select(),
      )
      return rows.length ? toHero(rows[0]) : null
    },
  }
}
