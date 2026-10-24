import { expect, it } from 'vitest'
import { CASE, randomDay } from './store-contract.js'

const at = (day, time) => new Date(`${day}T${time}:00.000Z`).toISOString()

// A timer run as POST /study/sessions/start creates it.
const timerRun = (day, overrides = {}) => ({ day, startedAt: at(day, '10:00'), endedAt: null, seconds: 0, topic: 'Promises', caseId: null, noteId: null, source: 'timer', ...overrides })

// The study log: every store must pass these. storeContract calls this inside its describe, with
// a getter for the store and the test users' ids (fresh accounts on Supabase).
export function studyStoreContract(getStore, ids) {
  it('creates, reads, lists by day, edits and deletes study sessions, only my own', async () => {
    const store = getStore()
    const day = randomDay()
    const kase = await store.createCase(ids.alice, CASE)
    const created = await store.createStudySession(ids.alice, timerRun(day, { caseId: kase.id }))
    expect(created).toMatchObject({ day, startedAt: at(day, '10:00'), endedAt: null, seconds: 0, topic: 'Promises', caseId: kase.id, noteId: null, source: 'timer' })
    expect(created.id).toEqual(expect.any(String))
    expect(created.createdAt).toEqual(expect.any(String))
    expect(created).not.toHaveProperty('userId')
    expect(await store.getStudySession(ids.alice, created.id)).toEqual(created)
    expect(await store.getStudySession(ids.bob, created.id)).toBeNull()

    const manual = await store.createStudySession(ids.alice, {
      day,
      startedAt: at(day, '15:00'),
      endedAt: at(day, '15:45'),
      seconds: 2700,
      topic: 'Closures',
      source: 'manual',
    })
    await store.createStudySession(ids.bob, timerRun(day))
    const nextDay = `${day.slice(0, 8)}${String(Number(day.slice(8)) + 1).padStart(2, '0')}`
    await store.createStudySession(ids.alice, timerRun(nextDay))
    // Latest start first, only that range, only mine.
    expect((await store.listStudySessions(ids.alice, { from: day, to: day })).map((item) => item.id)).toEqual([manual.id, created.id])
    expect(await store.listStudySessions(ids.alice, { from: nextDay, to: nextDay })).toHaveLength(1)

    const edited = await store.updateStudySession(ids.alice, created.id, { topic: 'Async/await', caseId: null })
    expect(edited).toMatchObject({ topic: 'Async/await', caseId: null, seconds: 0 })
    expect(await store.updateStudySession(ids.bob, created.id, { topic: 'mine now' })).toBeNull()

    expect(await store.deleteStudySession(ids.bob, manual.id)).toBe(false)
    expect(await store.deleteStudySession(ids.alice, manual.id)).toBe(true)
    expect(await store.getStudySession(ids.alice, manual.id)).toBeNull()
  })

  it('unlinks a session when its case or note is deleted', async () => {
    const store = getStore()
    const day = randomDay()
    const note = await store.createNote(ids.alice, { title: 'Async', blocks: [] })
    const session = await store.createStudySession(ids.alice, timerRun(day, { noteId: note.id }))
    expect((await store.getStudySession(ids.alice, session.id)).noteId).toBe(note.id)
    await store.deleteNote(ids.alice, note.id)
    expect((await store.getStudySession(ids.alice, session.id)).noteId).toBeNull()
  })

  it("adds reported seconds to an open run, never past the day's counted time", async () => {
    const store = getStore()
    const day = randomDay()
    await store.addStudyTime(ids.alice, day, 100, 16 * 3600)
    const first = await store.createStudySession(ids.alice, timerRun(day))
    const second = await store.createStudySession(ids.alice, timerRun(day, { startedAt: at(day, '11:00') }))

    expect(await store.attachStudySeconds(ids.alice, first.id, { day, seconds: 60 })).toMatchObject({ status: 'attached', session: { id: first.id, seconds: 60 } })
    // 40 seconds of room left in the day: the second run gets only those.
    expect(await store.attachStudySeconds(ids.alice, second.id, { day, seconds: 60 })).toMatchObject({ status: 'attached', session: { seconds: 40 } })
    expect(await store.attachStudySeconds(ids.alice, first.id, { day, seconds: 30 })).toMatchObject({ session: { seconds: 60 } })
    const total = (await store.listStudySessions(ids.alice, { from: day, to: day })).reduce((sum, item) => sum + item.seconds, 0)
    expect(total).toBe(100)

    // Someone else's run, a closed one, or one from another day.
    expect(await store.attachStudySeconds(ids.bob, first.id, { day, seconds: 10 })).toBeNull()
    const earlier = `${Number(day.slice(0, 4)) - 1}${day.slice(4)}`
    expect(await store.attachStudySeconds(ids.alice, first.id, { day: earlier, seconds: 10 })).toMatchObject({ status: 'other-day', session: { id: first.id } })
  })

  it('never adds timer seconds to a manual session', async () => {
    const store = getStore()
    const day = randomDay()
    await store.addStudyTime(ids.alice, day, 600, 16 * 3600)
    const manual = await store.createStudySession(ids.alice, { day, startedAt: at(day, '09:00'), endedAt: null, seconds: 1800, topic: 'Graphs', source: 'manual' })
    expect(await store.attachStudySeconds(ids.alice, manual.id, { day, seconds: 60 })).toBeNull()
  })

  it('closes a run, dropping one too short to keep, and leaves a closed run as it is', async () => {
    const store = getStore()
    const day = randomDay()
    await store.addStudyTime(ids.alice, day, 600, 16 * 3600)
    const short = await store.createStudySession(ids.alice, timerRun(day))
    await store.attachStudySeconds(ids.alice, short.id, { day, seconds: 59 })
    expect(await store.closeStudySession(ids.alice, short.id, at(day, '10:01'), 60)).toEqual({ dropped: true })
    expect(await store.getStudySession(ids.alice, short.id)).toBeNull()

    const run = await store.createStudySession(ids.alice, timerRun(day))
    await store.attachStudySeconds(ids.alice, run.id, { day, seconds: 300 })
    expect(await store.listOpenStudySessions(ids.alice)).toEqual([expect.objectContaining({ id: run.id })])
    expect(await store.closeStudySession(ids.bob, run.id, at(day, '10:05'), 60)).toBeNull()
    const closed = await store.closeStudySession(ids.alice, run.id, at(day, '10:05'), 60)
    expect(closed.session).toMatchObject({ id: run.id, endedAt: at(day, '10:05'), seconds: 300 })
    expect(await store.closeStudySession(ids.alice, run.id, at(day, '11:00'), 60)).toEqual({ session: closed.session })
    expect(await store.listOpenStudySessions(ids.alice)).toEqual([])
    // A closed run takes no more seconds.
    expect(await store.attachStudySeconds(ids.alice, run.id, { day, seconds: 60 })).toBeNull()
  })
}
