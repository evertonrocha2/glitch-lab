// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENT_LIMITS, VOTING_MS, WINNERS_EDIT_MS } from '../../shared/events.js'
import { call, makeUser } from './community-helpers.js'
import { api, useTempStore } from './helpers.js'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const START = Date.parse('2026-10-22T12:00:00Z')

let store
let ada
let bob
let cy

const iso = (offset) => new Date(Date.now() + offset).toISOString()
const fields = (overrides = {}) => ({
  title: 'Rinha de Backend',
  summary: 'Build the fastest payments API you can.',
  description: 'Two endpoints, one database.\n\nKeep it under 1.5 CPUs.',
  rules: 'One entry each.\n\nShip a docker-compose file.',
  prizes: 'A gold pixel medal.',
  kind: 'battle',
  tags: ['backend', 'Go'],
  startsAt: iso(0),
  endsAt: iso(3 * DAY),
  requirements: { repo: 'required', video: 'optional', demo: 'off' },
  ...overrides,
})
const entry = (overrides = {}) => ({ title: 'Queue first', description: 'A queue in front of Postgres.', repoUrl: 'https://github.com/bob/rinha', ...overrides })

const create = (body, token = ada.token) => call('POST', '/api/events', { body, token })
// No action edits the event; close and winners have their own routes.
const edit = (id, { action, ...body }, token = ada.token) =>
  action === undefined ? call('PATCH', `/api/events/${id}`, { body, token }) : call('POST', `/api/events/${id}/${action}`, { body, token })
const getEvent = (id, token = null) => call('GET', `/api/events/${id}`, { token })
const submit = (eventId, body, token) => call('POST', `/api/events/${eventId}/entries`, { body, token })
const vote = (entryId, value, token) => call('POST', `/api/entries/${entryId}/votes`, { body: { vote: value }, token })
const later = (ms) => vi.setSystemTime(Date.now() + ms)

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(START)
  store = await useTempStore()
  ada = await makeUser(store, 'ada', { profile: { handle: 'ada_dev', displayName: 'Ada', isPublic: true } })
  bob = await makeUser(store, 'bob', { profile: { displayName: 'Bo' } })
  cy = await makeUser(store, 'cy')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('creating events', () => {
  it('creates an event that anyone can read, signed out too', async () => {
    const res = await create(fields())
    expect(res.status).toBe(201)
    expect(res.body.event).toMatchObject({
      title: 'Rinha de Backend',
      kind: 'battle',
      tags: ['backend', 'go'],
      status: 'live',
      organizer: { name: 'Ada', handle: 'ada_dev' },
      mine: true,
      entryCount: 0,
      requirements: { repo: 'required', video: 'optional', demo: 'off' },
    })
    expect(res.body.event.closesAt).toBe(new Date(Date.parse(res.body.event.endsAt) + VOTING_MS).toISOString())
    expect(JSON.stringify(res.body)).not.toContain(ada.id)

    const read = await getEvent(res.body.event.id)
    expect(read.status).toBe(200)
    expect(read.body).toMatchObject({ event: { title: 'Rinha de Backend', mine: false }, entries: [], myEntry: null, myVotes: [] })
    expect((await getEvent('missing')).status).toBe(404)
  })

  it('asks for sign in and refuses demo accounts', async () => {
    expect((await create(fields(), null)).status).toBe(401)
    const demo = await create(fields(), 'dev:demo')
    expect(demo.status).toBe(403)
    expect(demo.body.message).toBe('Sign up to create events.')
  })

  it('checks every field', async () => {
    const problem = async (overrides) => (await create(fields(overrides))).body.message
    expect(await problem({ title: '  ' })).toBe('Give your event a title.')
    expect(await problem({ title: 'x'.repeat(EVENT_LIMITS.title + 1) })).toBe(`Too long. Keep your title under ${EVENT_LIMITS.title + 1} characters.`)
    expect(await problem({ summary: '' })).toBe('Add a one-line summary.')
    expect(await problem({ summary: 'x'.repeat(EVENT_LIMITS.summary + 1) })).toMatch(/summary/)
    expect(await problem({ description: ' ' })).toBe('Describe the event.')
    expect(await problem({ description: 'x'.repeat(EVENT_LIMITS.description + 1) })).toMatch(/description/)
    expect(await problem({ rules: 'x'.repeat(EVENT_LIMITS.rules + 1) })).toMatch(/rules/)
    expect(await problem({ kind: 'party' })).toBe('Pick a kind of event.')
    expect(await problem({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] })).toBe('Use up to 5 tags.')
    expect(await problem({ startsAt: 'soon' })).toBe('Pick a start and an end date.')
    expect(await problem({ startsAt: iso(-HOUR) })).toBe('Pick a start date from now on.')
    expect(await problem({ startsAt: iso(400 * DAY), endsAt: iso(401 * DAY) })).toBe('Pick a start date within a year.')
    expect(await problem({ endsAt: iso(-1) })).toBe('The end must come after the start.')
    expect(await problem({ endsAt: iso(30 * 60_000) })).toBe('An event can last from 1 hour to 30 days.')
    expect(await problem({ endsAt: iso(31 * DAY) })).toBe('An event can last from 1 hour to 30 days.')
    expect(await problem({ requirements: { repo: 'off', video: 'optional', demo: 'off' } })).toBe('Invalid request.')
    expect((await create(fields({ requirements: undefined }))).body.event.requirements).toEqual({ repo: 'required', video: 'optional', demo: 'optional' })
  })

  it('allows a few events a day per person', async () => {
    for (let index = 0; index < EVENT_LIMITS.eventsPerDay; index++) expect((await create(fields())).status).toBe(201)
    const res = await create(fields())
    expect(res.status).toBe(429)
    expect(res.body.message).toBe(`You can create ${EVENT_LIMITS.eventsPerDay} events a day. Come back tomorrow.`)
  })

  it('lists events by tab with search, signed out', async () => {
    const live = (await create(fields({ title: 'Live rinha' }))).body.event
    const soon = (await create(fields({ title: 'Study group', kind: 'study-group', startsAt: iso(DAY), endsAt: iso(2 * DAY) }))).body.event
    const list = async (query) => (await call('GET', `/api/events?${query}`)).body
    expect((await list('tab=live')).events.map((item) => item.id)).toEqual([live.id])
    expect((await list('tab=upcoming')).events.map((item) => item.id)).toEqual([soon.id])
    expect((await list('tab=ended')).events).toEqual([])
    expect((await list('tab=upcoming&q=rinha')).events).toEqual([])
    expect((await list('q=rinha')).events.map((item) => item.id)).toEqual([live.id])
    const [card] = (await list('tab=live')).events
    expect(card).toMatchObject({ title: 'Live rinha', status: 'live', entryCount: 0, organizer: { name: 'Ada' } })
    expect(card.description).toBeUndefined()
  })
})

describe('organizer tools', () => {
  it('lets only the organizer edit, and only before the start', async () => {
    const event = (await create(fields({ startsAt: iso(DAY), endsAt: iso(2 * DAY) }))).body.event
    const changed = fields({ title: 'Rinha 2', startsAt: iso(DAY), endsAt: iso(3 * DAY) })
    expect((await edit(event.id, changed, bob.token)).status).toBe(403)
    const res = await edit(event.id, changed)
    expect(res.status).toBe(200)
    expect(res.body.event).toMatchObject({ title: 'Rinha 2', endsAt: changed.endsAt })

    later(DAY + 1)
    const started = await edit(event.id, changed)
    expect(started.status).toBe(409)
    expect(started.body.message).toBe('You can only change an event before it starts.')
  })

  it('refuses actions it does not know, including names inherited from Object', async () => {
    const event = (await create(fields())).body.event
    for (const action of ['party', 'constructor', '__proto__', 'toString', 'hasOwnProperty', 42]) {
      const res = await edit(event.id, { action })
      expect([res.status, res.body.message]).toEqual([404, 'Not found.'])
    }
    // An edit with no fields at all is a bad request, not an empty change.
    const empty = await call('PATCH', `/api/events/${event.id}`, { token: ada.token })
    expect([empty.status, empty.body.message]).toEqual([400, 'Invalid request.'])
  })

  it('closes a live event early, by the organizer only', async () => {
    const event = (await create(fields())).body.event
    expect((await edit(event.id, { action: 'close' }, bob.token)).status).toBe(403)
    const res = await edit(event.id, { action: 'close' })
    expect(res.body.event).toMatchObject({ status: 'voting', endsAt: new Date(Date.now()).toISOString() })
    expect((await edit(event.id, { action: 'close' })).body.message).toBe('This event is not live.')
  })

  it('picks up to three winners after the end and tells every participant', async () => {
    const event = (await create(fields())).body.event
    const one = (await submit(event.id, entry(), bob.token)).body.entry
    const two = (await submit(event.id, entry({ title: 'Cache it' }), cy.token)).body.entry
    const pick = (winners, token = ada.token) => edit(event.id, { action: 'winners', winners }, token)

    expect((await pick([one.id])).body.message).toBe('Pick the winners once the event ends.')
    later(3 * DAY)
    expect((await pick([one.id], bob.token)).status).toBe(403)
    expect((await pick([])).body.message).toBe('Pick 1 to 3 different entries from this event.')
    expect((await pick([one.id, one.id])).status).toBe(400)
    expect((await pick(['missing'])).status).toBe(400)

    const res = await pick([two.id, one.id])
    expect(res.status).toBe(200)
    expect(res.body.event).toMatchObject({ status: 'ended', announced: true })
    const read = (await getEvent(event.id)).body
    expect(read.entries.map((item) => [item.title, item.place])).toEqual([
      ['Queue first', 2],
      ['Cache it', 1],
    ])
    for (const person of [bob, cy]) {
      const [note] = (await call('GET', '/api/notifications', { token: person.token })).body.notifications
      expect(note).toMatchObject({ type: 'event_winner', eventId: event.id, eventTitle: 'Rinha de Backend', actor: { name: 'Ada' } })
    }
  })

  it('lets the organizer change the winners for a while, then makes them final', async () => {
    const event = (await create(fields())).body.event
    const one = (await submit(event.id, entry(), bob.token)).body.entry
    const two = (await submit(event.id, entry({ title: 'Cache it' }), cy.token)).body.entry
    const pick = (winners) => edit(event.id, { action: 'winners', winners })
    later(3 * DAY)
    const first = (await pick([one.id])).body.event
    expect(first.announcedAt).toBe(new Date(Date.now()).toISOString())

    // Changing the pick keeps the first announcement time, so the lock never moves.
    later(WINNERS_EDIT_MS - HOUR)
    const changed = await pick([two.id, one.id])
    expect(changed.status).toBe(200)
    expect(changed.body.event.announcedAt).toBe(first.announcedAt)

    later(HOUR)
    const late = await pick([one.id])
    expect([late.status, late.body.message]).toEqual([409, 'The winners are final and can no longer change.'])
    const places = (await getEvent(event.id)).body.entries.map((item) => [item.title, item.place])
    expect(places).toEqual(expect.arrayContaining([['Cache it', 1], ['Queue first', 2]]))
  })
})

describe('entries', () => {
  let event
  beforeEach(async () => {
    event = (await create(fields({ requirements: { repo: 'required', video: 'optional', demo: 'optional' } }))).body.event
  })

  it('takes one entry per person while live and tells the organizer', async () => {
    const res = await submit(event.id, entry({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ', demoUrl: '' }), bob.token)
    expect(res.status).toBe(201)
    expect(res.body.entry).toMatchObject({ title: 'Queue first', repoUrl: 'https://github.com/bob/rinha', videoUrl: 'https://youtu.be/dQw4w9WgXcQ', demoUrl: null, votes: 0, mine: true, author: { name: 'Bo' } })
    const again = await submit(event.id, entry(), bob.token)
    expect(again.status).toBe(409)
    expect(again.body.message).toBe('You already have an entry in this event. Edit it instead.')

    const read = (await getEvent(event.id, bob.token)).body
    expect(read.event.entryCount).toBe(1)
    expect(read.myEntry).toMatchObject({ id: res.body.entry.id, mine: true })
    const [note] = (await call('GET', '/api/notifications', { token: ada.token })).body.notifications
    expect(note).toMatchObject({ type: 'event_join', eventId: event.id, actor: { name: 'Bo' } })
  })

  it('refuses signed-out, demo and organizer entries, and closed events', async () => {
    expect((await submit(event.id, entry(), null)).status).toBe(401)
    const demo = await submit(event.id, entry(), 'dev:demo')
    expect([demo.status, demo.body.message]).toEqual([403, 'Sign up to join events.'])
    const own = await submit(event.id, entry(), ada.token)
    expect([own.status, own.body.message]).toEqual([403, "You can't enter your own event."])
    expect((await submit('missing', entry(), bob.token)).status).toBe(404)

    const soon = (await create(fields({ startsAt: iso(DAY), endsAt: iso(2 * DAY) }))).body.event
    expect((await submit(soon.id, entry(), bob.token)).body.message).toBe('This event has not started yet.')
    later(3 * DAY)
    expect((await submit(event.id, entry(), bob.token)).body.message).toBe('Entries are closed for this event.')
  })

  it('checks every link against its own sites and the event requirements', async () => {
    const problem = async (overrides) => (await submit(event.id, entry(overrides), bob.token)).body.message
    expect(await problem({ title: ' ' })).toBe('Give your entry a title.')
    expect(await problem({ description: 'x'.repeat(EVENT_LIMITS.entryDescription + 1) })).toMatch(/description/)
    expect(await problem({ repoUrl: '' })).toBe('This event asks for a repository link.')
    expect(await problem({ repoUrl: 'https://evil.com/bob/rinha' })).toBe("That repository link won't work. Use a GitHub, GitLab, Bitbucket or Codeberg link for the code.")
    expect(await problem({ videoUrl: 'https://tiktok.com/@bob/1' })).toBe("That video link won't work. Use a YouTube, Vimeo or Loom link for the video.")
    expect(await problem({ demoUrl: 'javascript:alert(1)' })).toBe("That demo link won't work. Use a full https:// link.")
    expect(await problem({ demoUrl: 'data:text/html,hi' })).toBe("That demo link won't work. Use a full https:// link.")

    const videoOnly = (await create(fields({ requirements: { repo: 'optional', video: 'required', demo: 'off' } }))).body.event
    const res = await submit(videoOnly.id, entry({ repoUrl: '', demoUrl: 'https://bob.dev' }), bob.token)
    expect(res.body.message).toBe('This event asks for a video link.')
    const ok = await submit(videoOnly.id, entry({ repoUrl: '', videoUrl: 'https://vimeo.com/1', demoUrl: 'https://bob.dev' }), bob.token)
    // A link the event turned off is left out.
    expect(ok.body.entry).toMatchObject({ repoUrl: null, videoUrl: 'https://vimeo.com/1', demoUrl: null })
  })

  it('lets only the author edit an entry, while the event is live', async () => {
    const mine = (await submit(event.id, entry(), bob.token)).body.entry
    const update = (body, token) => call('PATCH', `/api/entries/${mine.id}`, { body, token })
    expect((await update(entry({ title: 'Stolen' }), cy.token)).status).toBe(403)
    const res = await update(entry({ title: 'Queue first, v2' }), bob.token)
    expect(res.body.entry).toMatchObject({ title: 'Queue first, v2', mine: true })
    later(3 * DAY)
    expect((await update(entry(), bob.token)).body.message).toBe('Entries are closed for this event.')
  })

  it('locks an entry once it gets its first vote', async () => {
    const mine = (await submit(event.id, entry(), bob.token)).body.entry
    const update = (body) => call('PATCH', `/api/entries/${mine.id}`, { body, token: bob.token })
    expect((await update(entry({ title: 'Before votes' }))).status).toBe(200)
    await vote(mine.id, true, cy.token)
    const res = await update(entry({ title: 'Something else' }))
    expect([res.status, res.body.message]).toEqual([409, 'Your entry has votes now, so it can no longer change.'])
    expect((await getEvent(event.id)).body.entries[0].title).toBe('Before votes')
  })
})

describe('votes', () => {
  let event
  let mine
  beforeEach(async () => {
    event = (await create(fields())).body.event
    mine = (await submit(event.id, entry(), bob.token)).body.entry
  })

  it('toggles one vote per person and entry, and tells the author once', async () => {
    expect((await vote(mine.id, true, cy.token)).body).toEqual({ voted: true, votes: 1 })
    expect((await vote(mine.id, true, ada.token)).body).toEqual({ voted: true, votes: 2 })
    expect((await vote(mine.id, false, cy.token)).body).toEqual({ voted: false, votes: 1 })
    await vote(mine.id, true, cy.token)
    expect((await getEvent(event.id, cy.token)).body.myVotes).toEqual([mine.id])
    const notes = (await call('GET', '/api/notifications', { token: bob.token })).body.notifications
    expect(notes.filter((item) => item.type === 'event_vote')).toHaveLength(2)
  })

  it('refuses self votes, demo and signed-out votes, and votes after voting closes', async () => {
    const own = await vote(mine.id, true, bob.token)
    expect([own.status, own.body.message]).toEqual([403, "You can't vote for your own entry."])
    expect((await vote(mine.id, true, null)).status).toBe(401)
    const demo = await vote(mine.id, true, 'dev:demo')
    expect([demo.status, demo.body.message]).toEqual([403, 'Sign up to vote.'])
    expect((await vote('missing', true, cy.token)).status).toBe(404)
    expect((await vote(mine.id, 'yes', cy.token)).status).toBe(400)

    // Still open in the voting window after the end, closed after it.
    later(3 * DAY)
    expect((await vote(mine.id, true, cy.token)).status).toBe(200)
    later(VOTING_MS)
    expect((await vote(mine.id, true, ada.token)).body.message).toBe('Voting is closed for this event.')
  })

  it('ranks entries by votes in the event view', async () => {
    const other = (await submit(event.id, entry({ title: 'Cache it' }), cy.token)).body.entry
    const dan = await makeUser(store, 'dan')
    await vote(other.id, true, ada.token)
    await vote(other.id, true, dan.token)
    await vote(mine.id, true, dan.token)
    const { entries } = (await getEvent(event.id)).body
    expect(entries.map((item) => [item.title, item.votes, item.rank])).toEqual([
      ['Cache it', 2, 1],
      ['Queue first', 1, 2],
    ])
  })
})

describe('xp and badges', () => {
  it('pays for taking part, votes, winning and hosting, and shows on the activity graph', async () => {
    const dan = await makeUser(store, 'dan')
    const event = (await create(fields())).body.event
    const won = (await submit(event.id, entry(), bob.token)).body.entry
    await submit(event.id, entry(), cy.token)
    await submit(event.id, entry(), dan.token)
    await vote(won.id, true, cy.token)
    later(3 * DAY)
    await edit(event.id, { action: 'winners', winners: [won.id] })

    const progress = async (token) => (await api('/api/progress?today=2026-10-25', { method: 'GET', token })).json()
    const bobs = (await progress(bob.token)).progress
    expect(bobs.xp).toBe(30 + 120 + 2)
    expect(bobs.badges.filter((badge) => badge.earned).map((badge) => badge.id)).toEqual(expect.arrayContaining(['competitor', 'champion']))
    expect(bobs.activity.total).toBe(1)
    const adas = (await progress(ada.token)).progress
    expect(adas.xp).toBe(40)
    expect(adas.badges.find((badge) => badge.id === 'host').earned).toBe(true)
  })
})
