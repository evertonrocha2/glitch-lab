// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MESSAGE_LIMITS, slugify } from '../../shared/messages.js'
import { canReadCommunity } from '../../server/modules/communities/communities.access.js'
import { parseCommunity } from '../../server/modules/communities/communities.model.js'
import { call, makeUser } from './community-helpers.js'
import { useTempStore } from './helpers.js'

let store
let ada
let bob
let cy

beforeEach(async () => {
  store = await useTempStore()
  ada = await makeUser(store, 'ada', { profile: { handle: 'ada_dev', displayName: 'Ada', isPublic: true } })
  bob = await makeUser(store, 'bob', { profile: { displayName: 'Bo' } })
  cy = await makeUser(store, 'cy')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

const FIELDS = { name: 'Café com JS', description: 'Async, closures and coffee.', topics: ['javascript', 'study-group'], color: 'cobalt', icon: 'coffee' }
const create = (fields, token = ada.token) => call('POST', '/api/communities', { body: { ...FIELDS, ...fields }, token })
const join = (slug, token) => call('POST', `/api/communities/${slug}/join`, { token })
const post = (slug, body, token) => call('POST', `/api/communities/${slug}/messages`, { body: { body }, token })
const chat = (slug, token = null) => call('GET', `/api/communities/${slug}/messages`, { token })

describe('creating and listing', () => {
  it('creates a community with a slug from its name, its owner as first member', async () => {
    const res = await create()
    expect(res.status).toBe(201)
    expect(res.body.community).toMatchObject({ slug: 'cafe-com-js', name: 'Café com JS', topics: ['javascript', 'study-group'], color: 'cobalt', icon: 'coffee', memberCount: 1, joined: true })
    expect((await create({}, bob.token)).body.community.slug).toBe('cafe-com-js-2')

    const page = await call('GET', '/api/communities/cafe-com-js')
    expect(page.body.community).toMatchObject({ name: 'Café com JS', owner: { handle: 'ada_dev', name: 'Ada' }, joined: false })
    expect(page.body.membership).toBeNull()
    expect(page.body.canPost).toBe(false)
    // Signed out nobody sees account ids or emails.
    expect(page.body.members).toEqual([{ person: expect.objectContaining({ name: 'Ada' }), role: 'owner', joinedAt: expect.any(String) }])
    expect(JSON.stringify(page.body)).not.toMatch(/example\.com/)
  })

  it('checks the fields', async () => {
    expect((await create({ name: 'JS' })).body.message).toBe('Name the community with 3 to 40 characters.')
    expect((await create({ name: 'x'.repeat(41) })).status).toBe(400)
    expect((await create({ description: 'x'.repeat(301) })).status).toBe(413)
    expect((await create({ topics: ['cooking'] })).body.message).toBe('Pick topics from the list.')
    expect((await create({ topics: ['javascript', 'python', 'java', 'data'] })).body.message).toBe('Pick up to 3 topics.')
    expect((await create({ color: 'red' })).body.message).toBe('Pick a color and an icon from the list.')
    expect((await call('POST', '/api/communities', { body: { description: 'no name' }, token: ada.token })).status).toBe(400)
  })

  it('lets a real account create up to 3, and no demo account', async () => {
    for (const name of ['One club', 'Two club', 'Three club']) expect((await create({ name })).status).toBe(201)
    const fourth = await create({ name: 'Four club' })
    expect(fourth.status).toBe(403)
    expect(fourth.body.message).toBe('You can create up to 3 communities.')
    const demo = await create({}, 'dev:demo')
    expect(demo.status).toBe(403)
    expect(demo.body.message).toBe('Sign up to create a community.')
    expect((await create({}, null)).status).toBe(401)
  })

  it('lists by members, searches by name or topic, and marks the ones I joined', async () => {
    await create({ name: 'Python Brasil', topics: ['python'] })
    await create({ name: 'Backend battles', topics: ['backend'], description: 'Rinhas and queues.' }, bob.token)
    await join('backend-battles', cy.token)

    const all = await call('GET', '/api/communities', { token: cy.token })
    expect(all.body.communities.map((item) => [item.slug, item.memberCount, item.joined])).toEqual([
      ['backend-battles', 2, true],
      ['python-brasil', 1, false],
    ])
    expect(all.body.mine.map((item) => item.slug)).toEqual(['backend-battles'])
    expect((await call('GET', '/api/communities?q=rinhas')).body.communities.map((item) => item.slug)).toEqual(['backend-battles'])
    expect((await call('GET', '/api/communities?topic=python')).body.communities.map((item) => item.slug)).toEqual(['python-brasil'])
    expect((await call('GET', '/api/communities?q=nothing-like-this')).body).toMatchObject({ communities: [], hasMore: false, mine: [] })
    expect((await call('GET', '/api/communities/no-such-place')).status).toBe(404)
  })
})

describe('membership and chat', () => {
  beforeEach(async () => {
    await create()
  })

  it('joins, posts, reads in order, and leaves', async () => {
    const joined = await join('cafe-com-js', bob.token)
    expect(joined.body).toMatchObject({ membership: { role: 'member' }, canPost: true, community: { memberCount: 2, joined: true } })
    expect((await post('cafe-com-js', 'Oi pessoal', bob.token)).status).toBe(201)
    await post('cafe-com-js', 'Welcome!', ada.token)

    const listed = await chat('cafe-com-js', bob.token)
    expect(listed.body.messages.map((item) => [item.body, item.sender.name, item.mine, item.canDelete])).toEqual([
      ['Oi pessoal', 'Bo', true, true],
      ['Welcome!', 'Ada', false, false],
    ])
    // Public chat: readable signed out, without delete rights.
    expect((await chat('cafe-com-js')).body.messages.every((item) => !item.canDelete && !item.mine)).toBe(true)

    const left = await call('POST', '/api/communities/cafe-com-js/leave', { token: bob.token })
    expect(left.body).toMatchObject({ membership: null, community: { memberCount: 1 } })
    expect((await post('cafe-com-js', 'still here?', bob.token)).body.message).toBe('Join the community to post.')
    expect((await call('POST', '/api/communities/cafe-com-js/leave', { token: ada.token })).body.message).toBe("The owner can't leave their own community.")
  })

  it('lets demo accounts read but not join or post', async () => {
    await post('cafe-com-js', 'hello', ada.token)
    expect((await chat('cafe-com-js', 'dev:demo')).body.messages).toHaveLength(1)
    expect((await call('GET', '/api/communities/cafe-com-js', { token: 'dev:demo' })).body.canPost).toBe(false)
    expect((await join('cafe-com-js', 'dev:demo')).body.message).toBe('Sign up to join communities.')
    expect((await post('cafe-com-js', 'hi', 'dev:demo')).body.message).toBe('Sign up to send messages.')
  })

  it('checks bodies like DMs and shares their rate limit', async () => {
    await join('cafe-com-js', bob.token)
    expect((await post('cafe-com-js', '  ', bob.token)).status).toBe(400)
    expect((await post('cafe-com-js', 'x'.repeat(MESSAGE_LIMITS.body + 1), bob.token)).status).toBe(413)
    // The day's counter already at the limit (500 real writes would make the test slow).
    const addUsage = store.addUsage
    vi.spyOn(store, 'addUsage').mockImplementation(async (key, day) => (key === `messages:${bob.id}` ? MESSAGE_LIMITS.perDay + 1 : addUsage(key, day)))
    const limited = await post('cafe-com-js', 'one more', bob.token)
    expect(limited.status).toBe(429)
    expect(limited.body.message).toBe('You can send 500 messages a day. Come back tomorrow.')
    vi.restoreAllMocks()
  })

  it('lets members delete their own messages and the owner delete any', async () => {
    await join('cafe-com-js', bob.token)
    await join('cafe-com-js', cy.token)
    const bobs = (await post('cafe-com-js', 'mine', bob.token)).body.message
    const cys = (await post('cafe-com-js', 'spam spam', cy.token)).body.message
    const remove = (id, token) => call('DELETE', `/api/community-messages/${id}`, { token })

    expect((await remove(cys.id, bob.token)).body.message).toBe('You can only delete your own messages.')
    expect((await chat('cafe-com-js', ada.token)).body.messages.every((item) => item.canDelete)).toBe(true)
    expect((await remove(bobs.id, bob.token)).status).toBe(200)
    expect((await remove(cys.id, ada.token)).status).toBe(200)
    expect((await remove(cys.id, ada.token)).status).toBe(404)
    expect((await chat('cafe-com-js')).body.messages).toEqual([])
  })

  it('lets the owner remove a member, who then cannot post or join again', async () => {
    await join('cafe-com-js', bob.token)
    const owner = await call('GET', '/api/communities/cafe-com-js', { token: ada.token })
    const bobRow = owner.body.members.find((item) => item.person.name === 'Bo')
    expect(bobRow.id).toBe(bob.id)
    // Only the owner gets member ids.
    expect((await call('GET', '/api/communities/cafe-com-js', { token: bob.token })).body.members.every((item) => item.id === undefined)).toBe(true)

    const kick = (userId, token) => call('DELETE', `/api/communities/cafe-com-js/members/${userId}`, { token })
    expect((await kick(ada.id, bob.token)).body.message).toBe('Only the owner can remove members.')
    expect((await kick(ada.id, ada.token)).body.message).toBe("The owner can't be removed.")
    expect((await kick(cy.id, ada.token)).body.message).toBe('Member not found.')
    expect((await kick(bob.id, ada.token)).body).toEqual({ removed: true })

    expect((await post('cafe-com-js', 'hey', bob.token)).body.message).toBe('You were removed from this community.')
    expect((await join('cafe-com-js', bob.token)).body.message).toBe('You were removed from this community.')
    expect((await call('GET', '/api/communities/cafe-com-js')).body.community.memberCount).toBe(1)
  })

  it('takes reports on community messages from anyone who can read them', async () => {
    await join('cafe-com-js', bob.token)
    const message = (await post('cafe-com-js', 'rude words', bob.token)).body.message
    expect((await call('POST', '/api/reports', { body: { kind: 'community', messageId: message.id, reason: 'harassment' }, token: cy.token })).status).toBe(201)
    expect((await store.listReports())[0]).toMatchObject({ kind: 'community', reportedUserId: bob.id, snapshot: 'rude words' })
  })
})

describe('rules', () => {
  it('keeps the privacy check in one place', () => {
    expect(canReadCommunity({ isPrivate: false }, null)).toBe(true)
    expect(canReadCommunity({ isPrivate: true }, null)).toBe(false)
    expect(canReadCommunity({ isPrivate: true }, { role: 'removed' })).toBe(false)
    expect(canReadCommunity({ isPrivate: true }, { role: 'member' })).toBe(true)
  })

  it('parses names to one line and picks defaults', () => {
    expect(parseCommunity({ name: '  Rust\n  Rio  ' })).toEqual({ name: 'Rust Rio', description: '', topics: [], color: 'violet', icon: 'bug' })
    expect(slugify('Café & Código!')).toBe('cafe-codigo')
    expect(slugify('日本語')).toBe('')
  })

  it('gives a name with no usable letters a generic slug', async () => {
    expect((await create({ name: '日本語の会' })).body.community.slug).toBe('community')
  })
})
