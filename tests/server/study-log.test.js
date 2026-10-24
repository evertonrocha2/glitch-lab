// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STUDY_LOG } from '../../shared/study-log.js'
import { STALE_RUN_MS } from '../../server/modules/study/study.service.js'
import { api, useTempStore } from './helpers.js'
import { CASE } from './store-contract.js'

let store

const NOW = new Date('2026-10-22T15:00:00Z')
const TODAY = '2026-10-22'

beforeEach(async () => {
  store = await useTempStore()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const later = (ms) => vi.setSystemTime(new Date(Date.now() + ms))
const json = async (res) => ({ status: res.status, body: await res.json() })

const startRun = (body = {}, token) => api('/api/study/sessions/start', { body: { day: TODAY, ...body }, token })
const report = (body, token) => api('/api/progress/study-time', { body: { day: TODAY, ...body }, token })
const stopRun = (id, body = {}, token) => api(`/api/study/sessions/${id}/stop`, { body, token })
const logManual = (body, token) => api('/api/study/sessions', { body: { day: TODAY, minutes: 30, topic: 'Closures', ...body }, token })
const list = (query = `from=2026-10-01&to=2026-10-23`, token) => api(`/api/study/sessions?${query}`, { method: 'GET', token })
const progress = async (token) => (await (await api(`/api/progress?today=${TODAY}`, { method: 'GET', token })).json()).progress

// One minute of timer, reported to its session.
async function minute(sessionId, seconds = 60) {
  later(seconds * 1000)
  return json(await report({ seconds, sessionId }))
}

describe('the timer flow', () => {
  it('opens a session on start, fills it with the reports and closes it on stop', async () => {
    const { status, body } = await json(await startRun({ topic: '  Promises   em JS ' }))
    expect(status).toBe(201)
    expect(body.session).toMatchObject({ day: TODAY, startedAt: NOW.toISOString(), endedAt: null, seconds: 0, topic: 'Promises em JS', source: 'timer' })
    const id = body.session.id

    expect(await minute(id)).toEqual({ status: 200, body: { todaySeconds: 60, sessionId: id } })
    expect((await minute(id, 45)).body).toEqual({ todaySeconds: 105, sessionId: id })

    const stopped = await json(await stopRun(id, { endedAt: new Date(Date.now()).toISOString() }))
    expect(stopped.body.session).toMatchObject({ id, seconds: 105, endedAt: new Date(NOW.getTime() + 105_000).toISOString() })
    // Closed: further reports still count for the day, but not for the session.
    expect((await minute(id)).body).toEqual({ todaySeconds: 165, sessionId: null })
    expect((await store.getStudySession('alice', id)).seconds).toBe(105)
  })

  it('counts exactly the same study time with or without a session', async () => {
    const { body } = await json(await startRun())
    await minute(body.session.id)
    await minute(body.session.id, 30)
    expect(await store.listStudyTime('alice')).toEqual([{ day: TODAY, seconds: 90 }])

    // bob reports the same seconds with no session at all.
    await report({ seconds: 60 }, 'dev:bob')
    await report({ seconds: 30 }, 'dev:bob')
    const [alice, bob] = [await progress('dev:alice'), await progress('dev:bob')]
    expect(alice.todaySeconds).toBe(bob.todaySeconds)
    expect(alice.xp).toBe(bob.xp)
  })

  it("never lets a day's timer sessions add up to more than the day counted", async () => {
    // Earlier runs already hold most of the day's cap: only 30 seconds can still be counted.
    const earlier = 16 * 3600 - 30
    await store.addStudyTime('alice', TODAY, earlier, 16 * 3600)
    await store.createStudySession('alice', { day: TODAY, startedAt: '2026-10-22T00:00:00.000Z', endedAt: '2026-10-22T14:59:00.000Z', seconds: earlier, source: 'timer' })
    const { body } = await json(await startRun())
    await minute(body.session.id)
    await minute(body.session.id)
    const sessions = await store.listStudySessions('alice', { from: TODAY, to: TODAY })
    const counted = (await store.listStudyTime('alice'))[0].seconds
    expect(counted).toBe(16 * 3600)
    expect(sessions.find((item) => item.id === body.session.id).seconds).toBe(30)
    expect(sessions.reduce((sum, item) => sum + item.seconds, 0)).toBe(counted)
  })

  it('drops a run shorter than a minute', async () => {
    const { body } = await json(await startRun({ topic: 'Quick peek' }))
    await minute(body.session.id, 40)
    const stopped = await json(await stopRun(body.session.id))
    expect(stopped).toEqual({ status: 200, body: { session: null } })
    expect(await store.listStudySessions('alice', { from: TODAY, to: TODAY })).toEqual([])
    // The 40 seconds still count for the day.
    expect(await store.listStudyTime('alice')).toEqual([{ day: TODAY, seconds: 40 }])
  })

  it('ends a run at the last heartbeat the timer saw, never before it started or after now', async () => {
    const { body } = await json(await startRun())
    await minute(body.session.id, 120)
    const lastBeat = new Date(NOW.getTime() + 100_000).toISOString()
    later(3_600_000)
    expect((await json(await stopRun(body.session.id, { endedAt: lastBeat }))).body.session.endedAt).toBe(lastBeat)

    const again = (await json(await startRun())).body.session
    await minute(again.id, 120)
    const closed = (await json(await stopRun(again.id, { endedAt: '2001-01-01T00:00:00Z' }))).body.session
    expect(closed.endedAt).toBe(again.startedAt)
  })

  it('closes a run left open in a closed tab where it was last seen', async () => {
    const { body } = await json(await startRun())
    await minute(body.session.id, 300)
    later(STALE_RUN_MS + 60_000)
    const { sessions } = await (await list()).json()
    expect(sessions[0]).toMatchObject({ id: body.session.id, seconds: 300, endedAt: new Date(NOW.getTime() + 300_000).toISOString() })
  })

  it('closes the open run when a new one starts', async () => {
    const first = (await json(await startRun({ topic: 'One' }))).body.session
    await minute(first.id, 120)
    const second = (await json(await startRun({ topic: 'Two' }))).body.session
    expect((await store.getStudySession('alice', first.id)).endedAt).not.toBeNull()
    expect((await minute(first.id)).body.sessionId).toBeNull()
    expect((await minute(second.id)).body.sessionId).toBe(second.id)
  })

  it('carries a run past midnight into a new session for the new day', async () => {
    vi.setSystemTime(new Date('2026-10-22T23:58:00Z'))
    const { body } = await json(await startRun({ topic: 'Late night graphs' }))
    await minute(body.session.id, 120)
    const answer = await json(await report({ seconds: 60, sessionId: body.session.id, day: '2026-10-23' }))
    expect(answer.body.sessionId).not.toBe(body.session.id)
    const next = await store.getStudySession('alice', answer.body.sessionId)
    expect(next).toMatchObject({ day: '2026-10-23', seconds: 60, topic: 'Late night graphs', endedAt: null })
    expect((await store.getStudySession('alice', body.session.id)).endedAt).not.toBeNull()
  })

  it('accepts a start time from the client only within the last minutes', async () => {
    const asked = new Date(NOW.getTime() - 5 * 60_000).toISOString()
    expect((await json(await startRun({ startedAt: asked }))).body.session.startedAt).toBe(asked)
    const old = (await json(await startRun({ startedAt: '2026-10-21T08:00:00Z' }))).body.session
    expect(old.startedAt).toBe(new Date(NOW.getTime() - 15 * 60_000).toISOString())
    const future = (await json(await startRun({ startedAt: '2026-10-23T08:00:00Z' }))).body.session
    expect(future.startedAt).toBe(NOW.toISOString())
  })

  it("refuses odd starts, and another student's run", async () => {
    expect((await startRun({ day: '2026-09-01' })).status).toBe(400)
    expect((await startRun({ topic: 'x'.repeat(STUDY_LOG.topic + 1) })).status).toBe(400)
    expect((await startRun({ topic: 42 })).status).toBe(400)
    expect((await startRun({ startedAt: 'yesterday' })).status).toBe(400)
    const { body } = await json(await startRun())
    expect((await stopRun(body.session.id, {}, 'dev:bob')).status).toBe(404)
    expect((await report({ seconds: 60, sessionId: body.session.id }, 'dev:bob')).status).toBe(200)
    expect((await store.getStudySession('alice', body.session.id)).seconds).toBe(0)
    expect((await report({ seconds: 60, sessionId: 'x'.repeat(65) })).status).toBe(400)
    expect((await report({ seconds: 60, sessionId: 12 })).status).toBe(400)
  })
})

describe('manual entries', () => {
  it('logs a past session with a time, shown as manual', async () => {
    const { status, body } = await json(await logManual({ startedAt: '2026-10-21T13:00:00.000Z', minutes: 45, topic: 'Recursion' }))
    expect(status).toBe(201)
    expect(body.session).toMatchObject({
      day: TODAY,
      startedAt: '2026-10-21T13:00:00.000Z',
      endedAt: '2026-10-21T13:45:00.000Z',
      seconds: 2700,
      topic: 'Recursion',
      source: 'manual',
    })
  })

  it('logs one without a start time', async () => {
    const { body } = await json(await logManual({ day: '2026-10-20' }))
    expect(body.session).toMatchObject({ day: '2026-10-20', endedAt: null, seconds: 1800, source: 'manual' })
  })

  it('never counts for XP, streaks, badges or the activity graph', async () => {
    const before = await progress()
    for (let day = 16; day <= 22; day++) await logManual({ day: `2026-10-${day}`, minutes: STUDY_LOG.manualMaxMinutes })
    const after = await progress()
    expect(after.xp).toBe(before.xp)
    expect(after.streak).toBe(before.streak)
    expect(after.totalSeconds).toBe(0)
    expect(after.badges.filter((badge) => badge.earned)).toEqual(before.badges.filter((badge) => badge.earned))
    expect(after.activity).toEqual(before.activity)
    expect(await store.listStudyTime('alice')).toEqual([])
  })

  it('checks the day, the length, the time and the topic', async () => {
    const cases = [
      [{ day: '2026-10-14' }, 'Pick a day within the last 7 days.'],
      [{ day: '2026-10-25' }, 'Pick a day within the last 7 days.'],
      [{ day: 'yesterday' }, 'Pick a day within the last 7 days.'],
      [{ minutes: 4 }, 'Log from 5 minutes to 4 hours.'],
      [{ minutes: 241 }, 'Log from 5 minutes to 4 hours.'],
      [{ minutes: 30.5 }, 'Log from 5 minutes to 4 hours.'],
      [{ minutes: '30' }, 'Log from 5 minutes to 4 hours.'],
      [{ topic: '   ' }, 'Write what you studied.'],
      [{ topic: undefined }, 'Write what you studied.'],
      [{ topic: 'x'.repeat(121) }, 'Keep the topic up to 120 characters.'],
      // Ends after now.
      [{ startedAt: '2026-10-22T14:45:00.000Z', minutes: 30 }, 'Pick a start time on that day that has already passed.'],
      // Not on that day anywhere.
      [{ day: '2026-10-20', startedAt: '2026-10-22T09:00:00.000Z' }, 'Pick a start time on that day that has already passed.'],
      [{ startedAt: 'noon' }, 'Pick a start time on that day that has already passed.'],
    ]
    for (const [fields, message] of cases) {
      const { status, body } = await json(await logManual(fields))
      expect({ fields, status, message: body.message }).toEqual({ fields, status: 400, message })
    }
  })
})

describe('links, edits and deletes', () => {
  it('links only my own cases and notes', async () => {
    const mine = await store.createCase('alice', CASE)
    const theirs = await store.createCase('bob', CASE)
    const note = await store.createNote('alice', { title: 'Async', blocks: [] })
    const bobNote = await store.createNote('bob', { title: 'Mine', blocks: [] })

    expect((await json(await startRun({ caseId: mine.id }))).body.session.caseId).toBe(mine.id)
    expect(await json(await startRun({ caseId: theirs.id }))).toEqual({ status: 400, body: { message: 'That case is not on your board.' } })
    expect((await json(await logManual({ noteId: note.id }))).body.session.noteId).toBe(note.id)
    expect(await json(await logManual({ noteId: bobNote.id }))).toEqual({ status: 400, body: { message: 'That note is not in your notes.' } })
    expect((await logManual({ caseId: 42 })).status).toBe(400)
  })

  it('edits the topic and links of my own sessions', async () => {
    const note = await store.createNote('alice', { title: 'Async', blocks: [] })
    const { body } = await json(await logManual())
    const id = body.session.id
    const patch = (fields, token) => api(`/api/study/sessions/${id}`, { method: 'PATCH', body: fields, token })

    const edited = await json(await patch({ topic: 'Async/await', noteId: note.id }))
    expect(edited.body.session).toMatchObject({ topic: 'Async/await', noteId: note.id, seconds: 1800 })
    expect((await json(await patch({ noteId: null }))).body.session.noteId).toBeNull()
    // A manual entry keeps a topic; a timer run may lose it.
    expect((await json(await patch({ topic: '' }))).body.message).toBe('Write what you studied.')
    const run = (await json(await startRun({ topic: 'x' }))).body.session
    expect((await json(await api(`/api/study/sessions/${run.id}`, { method: 'PATCH', body: { topic: '' } }))).body.session.topic).toBe('')

    expect((await patch({ topic: 'mine' }, 'dev:bob')).status).toBe(404)
    expect((await patch({})).status).toBe(400)
    expect((await patch({ seconds: 99999 })).status).toBe(400)
  })

  it("deletes a session but never the time it counted", async () => {
    const { body } = await json(await startRun())
    await minute(body.session.id, 120)
    await stopRun(body.session.id)
    const remove = (token) => api(`/api/study/sessions/${body.session.id}`, { method: 'DELETE', token })
    expect((await remove('dev:bob')).status).toBe(404)
    expect(await json(await remove())).toEqual({ status: 200, body: { deleted: true } })
    expect((await remove()).status).toBe(404)
    expect(await store.listStudyTime('alice')).toEqual([{ day: TODAY, seconds: 120 }])
  })
})

describe('the list', () => {
  it("lists my sessions in a range with each day's counted time", async () => {
    await store.addStudyTime('alice', '2026-10-20', 1200, 16 * 3600)
    await logManual({ day: '2026-10-20' })
    await logManual({ day: '2026-10-21' }, 'dev:bob')
    const { status, body } = await json(await list('from=2026-10-19&to=2026-10-23'))
    expect(status).toBe(200)
    expect(body.sessions.map((item) => item.day)).toEqual(['2026-10-20'])
    expect(body.days).toEqual([{ day: '2026-10-20', seconds: 1200 }])
    expect((await (await list('from=2026-10-21&to=2026-10-23')).json()).sessions).toEqual([])
  })

  it('refuses a broken or too long range, and asks for sign in', async () => {
    expect((await list('from=2026-10-23&to=2026-10-01')).status).toBe(400)
    expect((await list('from=2026-01-01&to=2026-10-23')).status).toBe(400)
    expect((await list('from=nope&to=2026-10-23')).status).toBe(400)
    expect((await list('', null)).status).toBe(401)
    expect((await list('')).status).toBe(200)
  })
})

it('lets a demo account log up to its daily limit', async () => {
  for (let index = 0; index < STUDY_LOG.demoSessionsPerDay; index++) expect((await logManual({}, 'dev:demo')).status).toBe(201)
  expect(await json(await startRun({}, 'dev:demo'))).toEqual({
    status: 429,
    body: { message: `Demo accounts can log ${STUDY_LOG.demoSessionsPerDay} study sessions a day. Sign up to keep going.` },
  })
  // Regular accounts have no such limit.
  for (let index = 0; index < 3; index++) await logManual()
  expect((await logManual()).status).toBe(201)
})
