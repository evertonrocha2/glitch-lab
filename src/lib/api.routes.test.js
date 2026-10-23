// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  answerInterrogation,
  answerReview,
  checkFix,
  closeEvent,
  createEvent,
  getChallenge,
  getDuel,
  getDuelLobby,
  getEvent,
  getHunt,
  getInterrogation,
  getPracticeSnippet,
  getReview,
  listEvents,
  pickWinners,
  revealHint,
  sendDuel,
  sendHunt,
  startChallenge,
  startDemo,
  startReview,
  submitEntry,
  updateEntry,
  updateEvent,
  voteEntry,
} from './api.js'

// Every call the pages make, checked against the REST routes in server/modules/*/*.routes.js.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json({ duel: { id: 'd1' }, challenge: { id: 'c1' }, review: {}, session: {}, entry: {} })))
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const lastCall = () => {
  const [url, init] = fetch.mock.lastCall
  return { url, method: init.method, body: init.body && JSON.parse(init.body), keepalive: init.keepalive }
}

it('signs in the demo account', async () => {
  await startDemo('2026-10-22')
  expect(lastCall()).toEqual({ url: '/api/auth/demo', method: 'POST', body: { today: '2026-10-22' }, keepalive: undefined })
})

it('starts, reads, hints and checks gym challenges', async () => {
  await startChallenge('k1', 't1')
  expect(lastCall()).toMatchObject({ url: '/api/challenges', method: 'POST', body: { caseId: 'k1' } })
  await getChallenge('c 1', 't1')
  expect(lastCall()).toMatchObject({ url: '/api/challenges/c%201', method: 'GET' })
  await revealHint('c1', 't1')
  expect(lastCall()).toMatchObject({ url: '/api/challenges/c1/hints', method: 'POST', body: undefined })
  await checkFix('c1', 'fixed()', 't1')
  expect(lastCall()).toMatchObject({ url: '/api/challenges/c1/check', method: 'POST', body: { code: 'fixed()' } })
})

it('reads and answers an interrogation on its case', async () => {
  await getInterrogation('k1', 't1')
  expect(lastCall()).toMatchObject({ url: '/api/cases/k1/interrogation', method: 'GET' })
  await answerInterrogation({ caseId: 'k1', answer: 'It crashes' }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/cases/k1/interrogation/answers', method: 'POST', body: { answer: 'It crashes' } })
})

it('plays the line hunt', async () => {
  await getHunt('t1')
  expect(lastCall()).toMatchObject({ url: '/api/hunt', method: 'GET' })
  await sendHunt('start', { day: '2026-10-22' }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/hunt/start', method: 'POST', body: { day: '2026-10-22' } })
  await sendHunt('answer', { index: 0, line: 3, day: '2026-10-22' }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/hunt/answers', body: { index: 0, line: 3, day: '2026-10-22' } })
  await sendHunt('next', { day: '2026-10-22' }, 't1')
  expect(lastCall().url).toBe('/api/hunt/next')
  await sendHunt('practice', { id: 'js-1', line: 2 }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/hunt/practice/answers', body: { id: 'js-1', line: 2 } })
  await getPracticeSnippet('js-1', 't1')
  expect(lastCall()).toMatchObject({ url: '/api/hunt/practice?after=js-1', method: 'GET' })
  await getPracticeSnippet(null, 't1')
  expect(lastCall().url).toBe('/api/hunt/practice')
})

it('sends each duel move to its route', async () => {
  await getDuelLobby('t1')
  expect(lastCall()).toMatchObject({ url: '/api/duels', method: 'GET' })
  await getDuel('d 1', 't1')
  expect(lastCall()).toMatchObject({ url: '/api/duels/d%201', method: 'GET' })
  await sendDuel('create', {}, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/duels', method: 'POST', body: {} })
  await sendDuel('queue', undefined, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/duels/queue', body: {} })
  await sendDuel('bot', { from: 'd1' }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/duels/bot', body: { from: 'd1' } })
  await sendDuel('join', { code: 'ABC234' }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/duels/join', body: { code: 'ABC234' } })
  await sendDuel('join', { id: 'd1' }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/duels/d1/join', body: {} })
  await sendDuel('answer', { id: 'd1', round: 2, choice: 'b' }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/duels/d1/answers', body: { round: 2, choice: 'b' } })
  await sendDuel('focus', { id: 'd1', state: 'hidden' }, 't1', { keepalive: true })
  expect(lastCall()).toMatchObject({ url: '/api/duels/d1/focus', body: { state: 'hidden' }, keepalive: true })
  await sendDuel('leave', { id: 'd1' }, 't1')
  expect(lastCall().url).toBe('/api/duels/d1/leave')
  await sendDuel('rematch', { id: 'd1' }, 't1')
  expect(lastCall().url).toBe('/api/duels/d1/rematch')
})

it('runs a spaced review', async () => {
  await getReview('2026-10-22', 't1')
  expect(lastCall()).toMatchObject({ url: '/api/review?today=2026-10-22', method: 'GET' })
  await startReview('2026-10-22', 't1')
  expect(lastCall()).toMatchObject({ url: '/api/review/sessions', method: 'POST', body: { today: '2026-10-22' } })
  await answerReview({ sessionId: 's1', index: 0, choice: 'a', today: '2026-10-22' }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/review/answers', body: { sessionId: 's1', index: 0, choice: 'a', today: '2026-10-22' } })
})

it('reads, organizes and joins events', async () => {
  await listEvents({ q: 'jam', tab: 'live', page: 2 })
  expect(lastCall()).toMatchObject({ url: '/api/events?q=jam&tab=live&page=2', method: 'GET' })
  await listEvents()
  expect(lastCall().url).toBe('/api/events')
  await getEvent('e 1')
  expect(lastCall().url).toBe('/api/events/e%201')
  await createEvent({ title: 'Jam' }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/events', method: 'POST', body: { title: 'Jam' } })
  await updateEvent('e1', { title: 'Jam 2' }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/events/e1', method: 'PATCH', body: { title: 'Jam 2' } })
  await closeEvent('e1', 't1')
  expect(lastCall()).toMatchObject({ url: '/api/events/e1/close', method: 'POST', body: undefined })
  await pickWinners('e1', ['n1', 'n2'], 't1')
  expect(lastCall()).toMatchObject({ url: '/api/events/e1/winners', method: 'POST', body: { winners: ['n1', 'n2'] } })
  await submitEntry('e1', { title: 'Mine' }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/events/e1/entries', method: 'POST', body: { title: 'Mine' } })
  await updateEntry('n1', { title: 'Mine 2' }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/entries/n1', method: 'PATCH', body: { title: 'Mine 2' } })
  await voteEntry('n1', true, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/entries/n1/votes', method: 'POST', body: { vote: true } })
})
