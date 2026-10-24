import { randomUUID } from 'node:crypto'

const now = () => new Date().toISOString()

// The study log in the local JSON file: one row per timer run or hand-logged session.
// Spread into createLocalStore. Every write happens between one load() and one save() with no
// await in between, so two reports can't both read the same room left in a day.
export function createLocalStudy({ load, save }) {
  // Files saved before the log existed don't have the list yet.
  const sessionsOf = (data) => (data.studySessions ??= [])
  const own = (data, userId, id) => sessionsOf(data).find((item) => item.id === id && item.userId === userId)

  // A deleted case or note leaves the session with no link, like "on delete set null" in Postgres.
  function toSession(data, row) {
    const caseId = row.caseId && data.cases.some((item) => item.id === row.caseId) ? row.caseId : null
    const noteId = row.noteId && (data.notes ?? []).some((item) => item.id === row.noteId) ? row.noteId : null
    const { userId, ...rest } = row
    return structuredClone({ ...rest, caseId, noteId })
  }

  const latestFirst = (a, b) => b.startedAt.localeCompare(a.startedAt) || b.createdAt.localeCompare(a.createdAt)

  return {
    // fields: { day, startedAt, endedAt, seconds, topic, caseId, noteId, source }
    async createStudySession(userId, { day, startedAt, endedAt = null, seconds = 0, topic = '', caseId = null, noteId = null, source }) {
      const data = await load()
      const stamp = now()
      const row = { id: randomUUID(), userId, day, startedAt, endedAt, seconds, topic, caseId, noteId, source, createdAt: stamp, updatedAt: stamp }
      sessionsOf(data).push(row)
      await save()
      return toSession(data, row)
    },

    // Sessions whose day falls between from and to (both included), latest start first.
    async listStudySessions(userId, { from, to }) {
      const data = await load()
      return sessionsOf(data)
        .filter((item) => item.userId === userId && item.day >= from && item.day <= to)
        .sort(latestFirst)
        .map((row) => toSession(data, row))
    },

    // Timer runs not closed yet.
    async listOpenStudySessions(userId) {
      const data = await load()
      return sessionsOf(data)
        .filter((item) => item.userId === userId && item.source === 'timer' && item.endedAt === null)
        .sort(latestFirst)
        .map((row) => toSession(data, row))
    },

    async getStudySession(userId, id) {
      const data = await load()
      const found = own(data, userId, id)
      return found ? toSession(data, found) : null
    },

    // Topic and links only; null for a link clears it. null when the session isn't mine.
    async updateStudySession(userId, id, { topic, caseId, noteId }) {
      const data = await load()
      const found = own(data, userId, id)
      if (!found) return null
      if (topic !== undefined) found.topic = topic
      if (caseId !== undefined) found.caseId = caseId
      if (noteId !== undefined) found.noteId = noteId
      found.updatedAt = now()
      await save()
      return toSession(data, found)
    },

    async deleteStudySession(userId, id) {
      const sessions = sessionsOf(await load())
      const index = sessions.findIndex((item) => item.id === id && item.userId === userId)
      if (index === -1) return false
      sessions.splice(index, 1)
      await save()
      return true
    },

    // Adds up to `seconds` to an open timer session of that day, never letting the day's timer
    // sessions add up to more than the day's counted study time. null when there's no such open
    // session; { status: 'other-day', session } when the session belongs to another day.
    async attachStudySeconds(userId, id, { day, seconds }) {
      const data = await load()
      const found = own(data, userId, id)
      if (!found || found.source !== 'timer' || found.endedAt !== null) return null
      if (found.day !== day) return { status: 'other-day', session: toSession(data, found) }
      const total = data.study?.[`${userId}:${day}`] ?? 0
      const used = sessionsOf(data)
        .filter((item) => item.userId === userId && item.source === 'timer' && item.day === day)
        .reduce((sum, item) => sum + item.seconds, 0)
      found.seconds += Math.min(seconds, Math.max(0, total - used))
      found.updatedAt = now()
      await save()
      return { status: 'attached', session: toSession(data, found) }
    },

    // Ends a timer run at endedAt. A run with fewer than minSeconds counted is deleted instead:
    // { dropped: true }. Already closed: { session } as it was. null when it isn't my timer session.
    async closeStudySession(userId, id, endedAt, minSeconds) {
      const data = await load()
      const sessions = sessionsOf(data)
      const found = own(data, userId, id)
      if (!found || found.source !== 'timer') return null
      if (found.endedAt !== null) return { session: toSession(data, found) }
      if (found.seconds < minSeconds) {
        sessions.splice(sessions.indexOf(found), 1)
        await save()
        return { dropped: true }
      }
      found.endedAt = endedAt
      found.updatedAt = now()
      await save()
      return { session: toSession(data, found) }
    },
  }
}
