// Postgres "invalid input syntax for type uuid": a malformed id simply matches nothing.
const INVALID_UUID = '22P02'

// Timestamps as ISO strings with milliseconds, the same shape the local store keeps.
const iso = (value) => (value == null ? null : new Date(value).toISOString())

// Rows from a select and from the attach function's to_jsonb read the same.
const toSession = (row) =>
  row && {
    id: row.id,
    day: row.day,
    startedAt: iso(row.started_at),
    endedAt: iso(row.ended_at),
    seconds: row.seconds,
    topic: row.topic,
    caseId: row.case_id ?? null,
    noteId: row.note_id ?? null,
    source: row.source,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }

function unwrap({ data, error }) {
  if (error?.code === INVALID_UUID) return null
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

const defined = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined))

// The study log on Supabase (study_sessions). Spread into createSupabaseStore.
export function createSupabaseStudy(db) {
  const table = () => db.from('study_sessions')

  async function get(userId, id) {
    return toSession(unwrap(await table().select('*').eq('id', id).eq('user_id', userId).maybeSingle()))
  }

  return {
    async createStudySession(userId, { day, startedAt, endedAt = null, seconds = 0, topic = '', caseId = null, noteId = null, source }) {
      const row = { user_id: userId, day, started_at: startedAt, ended_at: endedAt, seconds, topic, case_id: caseId, note_id: noteId, source }
      return toSession(unwrap(await table().insert(row).select().single()))
    },

    async listStudySessions(userId, { from, to }) {
      const rows = unwrap(
        await table()
          .select('*')
          .eq('user_id', userId)
          .gte('day', from)
          .lte('day', to)
          .order('started_at', { ascending: false })
          .order('created_at', { ascending: false }),
      )
      return (rows ?? []).map(toSession)
    },

    async listOpenStudySessions(userId) {
      const rows = unwrap(
        await table()
          .select('*')
          .eq('user_id', userId)
          .eq('source', 'timer')
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .order('created_at', { ascending: false }),
      )
      return (rows ?? []).map(toSession)
    },

    getStudySession: get,

    async updateStudySession(userId, id, { topic, caseId, noteId }) {
      const patch = defined({ topic, case_id: caseId, note_id: noteId, updated_at: new Date().toISOString() })
      return toSession(unwrap(await table().update(patch).eq('id', id).eq('user_id', userId).select().maybeSingle()))
    },

    async deleteStudySession(userId, id) {
      const rows = unwrap(await table().delete().eq('id', id).eq('user_id', userId).select('id'))
      return (rows ?? []).length > 0
    },

    // One database function, so the room left in the day is read and used under one lock.
    async attachStudySeconds(userId, id, { day, seconds }) {
      const result = unwrap(await db.rpc('attach_study_seconds', { p_user: userId, p_id: id, p_day: day, p_seconds: seconds }))
      return result ? { status: result.status, session: toSession(result.session) } : null
    },

    // The update only lands on a run that's still open, so a report can't attach after it.
    async closeStudySession(userId, id, endedAt, minSeconds) {
      const found = await get(userId, id)
      if (!found || found.source !== 'timer') return null
      if (found.endedAt !== null) return { session: found }
      const closed = toSession(
        unwrap(
          await table()
            .update({ ended_at: endedAt, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId)
            .is('ended_at', null)
            .select()
            .maybeSingle(),
        ),
      )
      // Closed (or dropped) by another request in between.
      if (!closed) {
        const again = await get(userId, id)
        return again ? { session: again } : { dropped: true }
      }
      if (closed.seconds < minSeconds) {
        unwrap(await table().delete().eq('id', id).eq('user_id', userId))
        return { dropped: true }
      }
      return { session: closed }
    },
  }
}
