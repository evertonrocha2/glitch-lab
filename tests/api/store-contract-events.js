import { expect, it } from 'vitest'

// Community events: every store must pass these. storeContract calls this inside its describe.
// Events are shared by everyone and outlive each test on Supabase, so every search here narrows
// itself with a word made up for that test, and every person is a brand-new account.
const HOUR = 3_600_000
const marker = () => `m${crypto.randomUUID().slice(0, 8)}`
const idsOf = (list) => list.map((item) => item.id)

export const eventFields = (overrides = {}, now = Date.now()) => ({
  title: 'Rinha de Backend',
  summary: 'Build the fastest API.',
  description: 'Two endpoints.\n\nKeep it small.',
  rules: 'One entry each.',
  prizes: '',
  kind: 'battle',
  tags: ['backend'],
  startsAt: new Date(now - HOUR).toISOString(),
  endsAt: new Date(now + HOUR).toISOString(),
  closesAt: new Date(now + 3 * HOUR).toISOString(),
  requirements: { repo: 'required', video: 'optional', demo: 'off' },
  ...overrides,
})

const entryFields = (overrides = {}) => ({
  title: 'Queue first',
  description: 'A queue in front of Postgres.',
  repoUrl: 'https://github.com/ada/rinha',
  videoUrl: null,
  demoUrl: null,
  ...overrides,
})

export function eventsStoreContract(storeOf, newUser) {
  it('creates, reads and updates an event for its organizer only', async () => {
    const store = storeOf()
    const [ada, bob] = [await newUser(), await newUser()]
    const fields = eventFields()
    const created = await store.createEvent(ada.id, fields)
    expect(created).toMatchObject({ ...fields, organizerId: ada.id, entryCount: 0, announcedAt: null })
    expect(created.id).toEqual(expect.any(String))
    expect(created.createdAt).toEqual(expect.any(String))
    expect(await store.getEvent(created.id)).toEqual(created)
    expect(await store.getEvent(crypto.randomUUID())).toBeNull()

    expect(await store.updateEvent(bob.id, created.id, { title: 'Mine now' })).toBeNull()
    const updated = await store.updateEvent(ada.id, created.id, { title: 'Rinha 2', tags: ['go', 'rust'], requirements: { repo: 'optional', video: 'required', demo: 'optional' } })
    expect(updated).toMatchObject({ id: created.id, title: 'Rinha 2', summary: fields.summary, tags: ['go', 'rust'], requirements: { repo: 'optional', video: 'required', demo: 'optional' } })
    expect(await store.getEvent(created.id)).toEqual(updated)
  })

  it('lists events by tab at a given time, searches them, and pages through them', async () => {
    const store = storeOf()
    const ada = await newUser()
    const word = marker()
    const now = Date.now()
    const live = await store.createEvent(ada.id, eventFields({ title: `Live ${word}` }, now))
    const voting = await store.createEvent(
      ada.id,
      eventFields({ title: `Voting ${word}`, startsAt: new Date(now - 3 * HOUR).toISOString(), endsAt: new Date(now - HOUR).toISOString() }, now),
    )
    const soon = await store.createEvent(
      ada.id,
      eventFields({ title: `Soon ${word}`, startsAt: new Date(now + HOUR).toISOString(), endsAt: new Date(now + 2 * HOUR).toISOString(), closesAt: new Date(now + 4 * HOUR).toISOString() }, now),
    )
    const later = await store.createEvent(
      ada.id,
      eventFields({ title: 'Later', summary: `About ${word}`, startsAt: new Date(now + 5 * HOUR).toISOString(), endsAt: new Date(now + 6 * HOUR).toISOString(), closesAt: new Date(now + 7 * HOUR).toISOString() }, now),
    )
    const over = await store.createEvent(
      ada.id,
      eventFields({ title: `Over ${word}`, startsAt: new Date(now - 9 * HOUR).toISOString(), endsAt: new Date(now - 8 * HOUR).toISOString(), closesAt: new Date(now - 7 * HOUR).toISOString() }, now),
    )
    const tagged = await store.createEvent(ada.id, eventFields({ title: 'Tag only', tags: [word] }, now))

    const list = (params) => store.listEvents({ q: word, now: new Date(now).toISOString(), offset: 0, limit: 10, ...params })
    // Live and voting together, the one ending soonest first; upcoming by start; ended most recent first.
    expect(idsOf((await list({ tab: 'live' })).events)).toEqual([voting.id, live.id, tagged.id])
    expect(idsOf((await list({ tab: 'upcoming' })).events)).toEqual([soon.id, later.id])
    expect(idsOf((await list({ tab: 'ended' })).events)).toEqual([over.id])
    expect(idsOf((await list({ tab: 'live', organizerId: (await newUser()).id })).events)).toEqual([])
    expect((await list({ q: marker() })).events).toEqual([])

    const first = await list({ tab: 'live', limit: 2 })
    expect(first).toEqual({ events: expect.any(Array), hasMore: true })
    expect(idsOf(first.events)).toEqual([voting.id, live.id])
    const second = await list({ tab: 'live', offset: 2, limit: 2 })
    expect(second.hasMore).toBe(false)
    expect(idsOf(second.events)).toEqual([tagged.id])
  })

  it('keeps one entry per person and event, editable by its author only', async () => {
    const store = storeOf()
    const [ada, bob, cy] = [await newUser(), await newUser(), await newUser()]
    const event = await store.createEvent(ada.id, eventFields())
    const mine = await store.createEntry(event.id, bob.id, entryFields())
    expect(mine).toMatchObject({ ...entryFields(), eventId: event.id, userId: bob.id, votes: 0, place: null })
    expect(mine.createdAt).toEqual(expect.any(String))
    expect(await store.createEntry(event.id, bob.id, entryFields({ title: 'Again' }))).toBeNull()
    const theirs = await store.createEntry(event.id, cy.id, entryFields({ title: 'Cache all the things' }))

    expect(await store.getEntry(mine.id)).toEqual(mine)
    expect(await store.getEntry(crypto.randomUUID())).toBeNull()
    expect(await store.findEntry(event.id, bob.id)).toEqual(mine)
    expect(await store.findEntry(event.id, ada.id)).toBeNull()
    expect(idsOf(await store.listEntries(event.id))).toEqual([mine.id, theirs.id])
    expect((await store.getEvent(event.id)).entryCount).toBe(2)

    expect(await store.updateEntry(cy.id, mine.id, { title: 'Stolen' })).toBeNull()
    const edited = await store.updateEntry(bob.id, mine.id, { title: 'Queue first, v2', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' })
    expect(edited).toMatchObject({ id: mine.id, title: 'Queue first, v2', description: mine.description, videoUrl: 'https://youtu.be/dQw4w9WgXcQ' })
    expect(await store.getEntry(mine.id)).toEqual(edited)
  })

  it('keeps one vote per person and entry, with counts', async () => {
    const store = storeOf()
    const [ada, bob, cy, di] = [await newUser(), await newUser(), await newUser(), await newUser()]
    const event = await store.createEvent(ada.id, eventFields())
    const entry = await store.createEntry(event.id, bob.id, entryFields())
    const other = await store.createEntry(event.id, cy.id, entryFields())

    expect(await store.getVotes(event.id, di.id)).toEqual([])
    expect(await store.setVote(entry.id, di.id, true)).toEqual({ voted: true, votes: 1 })
    expect(await store.setVote(entry.id, di.id, true)).toEqual({ voted: true, votes: 1 })
    expect(await store.setVote(entry.id, ada.id, true)).toEqual({ voted: true, votes: 2 })
    await store.setVote(other.id, di.id, true)
    expect((await store.getVotes(event.id, di.id)).sort()).toEqual([entry.id, other.id].sort())
    expect((await store.getEntry(entry.id)).votes).toBe(2)

    expect(await store.setVote(entry.id, di.id, false)).toEqual({ voted: false, votes: 1 })
    expect(await store.getVotes(event.id, di.id)).toEqual([other.id])
    expect(await store.setVote(crypto.randomUUID(), di.id, true)).toBeNull()
  })

  it('sets the winners, clearing any earlier pick', async () => {
    const store = storeOf()
    const [ada, bob, cy, di] = [await newUser(), await newUser(), await newUser(), await newUser()]
    const event = await store.createEvent(ada.id, eventFields())
    const [one, two, three] = [
      await store.createEntry(event.id, bob.id, entryFields()),
      await store.createEntry(event.id, cy.id, entryFields()),
      await store.createEntry(event.id, di.id, entryFields()),
    ]
    await store.setPlaces(event.id, { [one.id]: 1, [two.id]: 2 })
    await store.setPlaces(event.id, { [three.id]: 1, [one.id]: 2 })
    const places = Object.fromEntries((await store.listEntries(event.id)).map((item) => [item.id, item.place]))
    expect(places).toEqual({ [one.id]: 2, [two.id]: null, [three.id]: 1 })
  })

  it("sums a person's entries, placings, votes received and hosted events", async () => {
    const store = storeOf()
    const [ada, bob, cy, di] = [await newUser(), await newUser(), await newUser(), await newUser()]
    expect(await store.eventStats(bob.id)).toEqual({ entries: 0, first: 0, second: 0, third: 0, votesReceived: 0, hosted: 0, days: [] })

    const big = await store.createEvent(ada.id, eventFields())
    const small = await store.createEvent(ada.id, eventFields())
    const won = await store.createEntry(big.id, bob.id, entryFields())
    await store.createEntry(big.id, cy.id, entryFields())
    await store.createEntry(big.id, di.id, entryFields())
    const second = await store.createEntry(small.id, bob.id, entryFields())
    await store.setVote(won.id, cy.id, true)
    await store.setVote(won.id, di.id, true)
    await store.setVote(second.id, cy.id, true)
    await store.setPlaces(big.id, { [won.id]: 1 })
    await store.setPlaces(small.id, { [second.id]: 2 })

    const stats = await store.eventStats(bob.id)
    expect(stats).toMatchObject({ entries: 2, first: 1, second: 1, third: 0, votesReceived: 3, hosted: 0 })
    expect(stats.days).toEqual([won.createdAt.slice(0, 10), second.createdAt.slice(0, 10)])
    // Hosting counts once an event has three entries.
    expect(await store.eventStats(ada.id)).toMatchObject({ entries: 0, hosted: 1 })
  })

  it('keeps event notifications with the event title, without repeats', async () => {
    const store = storeOf()
    const [ada, bob] = [await newUser(), await newUser()]
    const event = await store.createEvent(ada.id, eventFields({ title: 'Rinha de Backend' }))
    const note = { userId: ada.id, actorId: bob.id, eventId: event.id }
    const joined = await store.addNotification({ ...note, type: 'event_join' })
    expect(joined).toMatchObject({ ...note, type: 'event_join', articleId: null, read: false })
    expect(await store.addNotification({ ...note, type: 'event_join' })).toBeNull()
    const voted = await store.addNotification({ ...note, type: 'event_vote' })

    const listed = await store.listNotifications(ada.id)
    expect(idsOf(listed)).toEqual([voted.id, joined.id])
    expect(listed[0]).toMatchObject({ eventId: event.id, eventTitle: 'Rinha de Backend', articleTitle: null })
  })
}
