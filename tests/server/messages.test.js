// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MESSAGE_LIMITS } from '../../shared/messages.js'
import { messageBlocker } from '../../server/modules/messages/conversations.service.js'
import { parseCursor, parseMessageBody, spendMessage } from '../../server/modules/messages/messages.model.js'
import { call, makeUser } from './community-helpers.js'
import { useTempStore } from './helpers.js'

let store
let ada
let bob
let cy

beforeEach(async () => {
  store = await useTempStore()
  ada = await makeUser(store, 'ada', { profile: { handle: 'ada_dev', displayName: 'Ada', isPublic: true } })
  bob = await makeUser(store, 'bob', { profile: { handle: 'bob', displayName: 'Bo', isPublic: true } })
  cy = await makeUser(store, 'cy', { profile: { handle: 'cy', isPublic: true } })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

const start = (handle, token) => call('POST', '/api/conversations', { body: { handle }, token })
const send = (id, body, token) => call('POST', `/api/conversations/${id}/messages`, { body: { body }, token })
const read = (id, token, query = '') => call('GET', `/api/conversations/${id}/messages${query}`, { token })
const inbox = (token) => call('GET', '/api/conversations', { token })

async function talk() {
  const opened = await start('bob', ada.token)
  expect(opened.status).toBe(201)
  return opened.body.conversation
}

describe('starting a conversation', () => {
  it('opens one conversation per pair, from either side, with the public person shape only', async () => {
    const first = await talk()
    expect(first).toEqual({
      id: expect.any(String),
      other: { handle: 'bob', name: 'Bo', avatar: expect.any(Object), isPublic: true },
      blocked: false,
      canSend: true,
      reason: null,
    })
    expect(JSON.stringify(first)).not.toMatch(/@example\.com/)
    expect((await start('@BOB', ada.token)).body.conversation.id).toBe(first.id)
    expect((await call('POST', '/api/conversations', { body: { handle: 'ada_dev' }, token: bob.token })).body.conversation.id).toBe(first.id)
  })

  it('refuses yourself, demo accounts, unknown handles and people who take no messages', async () => {
    expect((await start('ada_dev', ada.token)).body.message).toBe("You can't message yourself.")
    const demo = await start('bob', 'dev:demo')
    expect(demo.status).toBe(403)
    expect(demo.body.message).toBe('Sign up to send messages.')
    expect((await start('nobody-here', ada.token)).status).toBe(404)
    expect((await start('', ada.token)).status).toBe(400)
    expect((await start('bob', null)).status).toBe(401)

    expect((await call('PATCH', '/api/messaging/settings', { body: { allowMessages: 'nobody' }, token: bob.token })).body).toEqual({ allowMessages: 'nobody' })
    const closed = await start('bob', ada.token)
    expect(closed.status).toBe(403)
    expect(closed.body.message).toBe("This person isn't taking messages right now.")
    expect((await call('GET', '/api/messaging/settings', { token: bob.token })).body).toEqual({ allowMessages: 'nobody' })
    expect((await call('PATCH', '/api/messaging/settings', { body: { allowMessages: 'friends' }, token: bob.token })).status).toBe(400)
  })

  it('tells the profile button whether I can message someone', async () => {
    const status = (handle, token = ada.token) => call('GET', `/api/messaging/with/${handle}`, { token })
    expect((await status('bob')).body).toEqual({ canMessage: true, reason: null, blocked: false, conversationId: null })
    const conversation = await talk()
    expect((await status('bob')).body.conversationId).toBe(conversation.id)
    expect((await status('ada_dev')).body).toMatchObject({ canMessage: false, reason: 'self' })
    expect((await status('bob', 'dev:demo')).body).toMatchObject({ canMessage: false, reason: 'demo' })
    expect((await status('missing')).status).toBe(404)
  })

  it('caps new conversations a day, but reopening one is free', async () => {
    const conversation = await talk()
    for (let n = 1; n < MESSAGE_LIMITS.newConversationsPerDay; n++) {
      await store.addUsage(`conversations:${ada.id}`, new Date().toISOString().slice(0, 10))
    }
    expect((await start('bob', ada.token)).body.conversation.id).toBe(conversation.id)
    const capped = await start('cy', ada.token)
    expect(capped.status).toBe(429)
    expect(capped.body.message).toMatch(/new conversations a day/)
  })
})

describe('messages', () => {
  it('sends, lists oldest first, and shows the inbox with unread marks on the other side', async () => {
    const { id } = await talk()
    const sent = await send(id, '  Hi Bo!\nSee https://example.com  ', ada.token)
    expect(sent.status).toBe(201)
    expect(sent.body.message).toMatchObject({ body: 'Hi Bo!\nSee https://example.com', mine: true, sender: { name: 'Ada' } })
    await send(id, 'Hey Ada', bob.token)

    const listed = await read(id, ada.token)
    expect(listed.body.messages.map((item) => [item.body, item.mine])).toEqual([
      ['Hi Bo!\nSee https://example.com', true],
      ['Hey Ada', false],
    ])
    expect(listed.body).toMatchObject({ hasMore: false, conversation: { id, canSend: true } })
    expect(listed.headers.get('cache-control')).toBe('private, no-store')

    const adaInbox = (await inbox(ada.token)).body
    expect(adaInbox.unread).toBe(1)
    expect(adaInbox.conversations[0]).toMatchObject({ id, other: { name: 'Bo' }, unread: true, lastMessage: { body: 'Hey Ada', mine: false } })
    expect((await call('POST', `/api/conversations/${id}/read`, { token: ada.token })).body).toEqual({ unread: 0 })
    expect((await call('GET', '/api/conversations/unread', { token: ada.token })).body).toEqual({ unread: 0 })
    expect((await inbox(bob.token)).body.conversations[0]).toMatchObject({ unread: false, lastMessage: { mine: true } })
  })

  it('pages with before and after cursors', async () => {
    const { id } = await talk()
    const one = (await send(id, 'one', ada.token)).body.message
    const two = (await send(id, 'two', bob.token)).body.message
    await send(id, 'three', ada.token)
    const after = await read(id, ada.token, `?after=${encodeURIComponent(one.createdAt)}`)
    expect(after.body.messages.map((item) => item.body)).toEqual(['two', 'three'])
    const before = await read(id, ada.token, `?before=${encodeURIComponent(two.createdAt)}`)
    expect(before.body.messages.map((item) => item.body)).toEqual(['one'])
    expect((await read(id, ada.token, '?after=yesterday')).status).toBe(400)
  })

  it('says there are older messages when a page is full', async () => {
    const { id } = await talk()
    for (let n = 0; n <= MESSAGE_LIMITS.pageSize; n++) await store.createMessage(id, ada.id, `m${n}`)
    const page = await read(id, bob.token)
    expect(page.body.messages).toHaveLength(MESSAGE_LIMITS.pageSize)
    expect(page.body.hasMore).toBe(true)
    expect(page.body.messages.at(-1).body).toBe(`m${MESSAGE_LIMITS.pageSize}`)
  })

  it('only lets the two people in a conversation read or write it', async () => {
    const { id } = await talk()
    await send(id, 'private', ada.token)
    expect((await read(id, cy.token)).status).toBe(404)
    expect((await send(id, 'let me in', cy.token)).status).toBe(404)
    expect((await call('POST', `/api/conversations/${id}/read`, { token: cy.token })).status).toBe(404)
    expect((await read('not-a-real-id', ada.token)).status).toBe(404)
    expect((await read(id, null)).status).toBe(401)
  })

  it('checks the body: plain text, trimmed, 1 to 2000 characters', async () => {
    const { id } = await talk()
    expect((await send(id, '   ', ada.token)).body.message).toBe('Write a message first.')
    const long = await send(id, 'x'.repeat(MESSAGE_LIMITS.body + 1), ada.token)
    expect(long.status).toBe(413)
    expect(long.body.message).toBe('Too long. Keep your message under 2001 characters.')
    expect((await send(id, 'x'.repeat(MESSAGE_LIMITS.body), ada.token)).status).toBe(201)
    expect((await call('POST', `/api/conversations/${id}/messages`, { body: { body: 42 }, token: ada.token })).status).toBe(400)
    const html = await send(id, '<img src=x onerror=alert(1)>', ada.token)
    expect(html.body.message.body).toBe('<img src=x onerror=alert(1)>')
  })

  it('tells the other person once in the bell, until they read it', async () => {
    const { id } = await talk()
    await send(id, 'one', ada.token)
    await send(id, 'two', ada.token)
    const bell = (await call('GET', '/api/notifications', { token: bob.token })).body
    expect(bell.unread).toBe(1)
    expect(bell.notifications[0]).toMatchObject({ type: 'message', actor: { name: 'Ada' } })
    await call('POST', '/api/notifications/read', { body: { all: true }, token: bob.token })
    await send(id, 'three', ada.token)
    expect((await call('GET', '/api/notifications', { token: bob.token })).body.unread).toBe(1)
    expect((await call('GET', '/api/notifications', { token: ada.token })).body.unread).toBe(0)
  })

  it("nudges only the other person's own topic, with no content", async () => {
    vi.stubEnv('SUPABASE_URL', 'https://demo.supabase.co/')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'pk')
    const fetchMock = vi.fn(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const { id } = await talk()
      expect((await send(id, 'a secret plan', ada.token)).status).toBe(201)
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://demo.supabase.co/realtime/v1/api/broadcast')
      expect(init.headers.apikey).toBe('pk')
      expect(JSON.parse(init.body)).toEqual({ messages: [{ topic: `user:${bob.id}`, event: 'changed', payload: { type: 'changed', v: null }, private: false }] })
      expect(init.body).not.toMatch(/secret/)
      expect(init.body).not.toContain(ada.id)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('still sends when realtime is off or the nudge fails', async () => {
    const { id } = await talk()
    expect((await send(id, 'no realtime here', ada.token)).status).toBe(201)
    vi.stubEnv('SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'pk')
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
    try {
      expect((await send(id, 'still fine', ada.token)).status).toBe(201)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('stops sending once the other person closes their messages', async () => {
    const { id } = await talk()
    await call('PATCH', '/api/messaging/settings', { body: { allowMessages: 'nobody' }, token: bob.token })
    const res = await send(id, 'still there?', ada.token)
    expect(res.status).toBe(403)
    expect((await read(id, ada.token)).body.conversation).toMatchObject({ canSend: false, reason: 'unavailable' })
  })
})

describe('blocks', () => {
  it('forbids DMs both ways, hides the blocked person, and lifts on unblock', async () => {
    const { id } = await talk()
    await send(id, 'from bob', bob.token)
    await send(id, 'from ada', ada.token)
    await send(id, 'bob again', bob.token)
    expect((await call('POST', '/api/blocks', { body: { conversationId: id }, token: ada.token })).body).toEqual({ blocked: true })

    const mine = await read(id, ada.token)
    expect(mine.body.messages.map((item) => item.body)).toEqual(['from ada'])
    expect(mine.body.conversation).toMatchObject({ blocked: true, canSend: false, reason: 'blocked' })
    expect((await inbox(ada.token)).body).toMatchObject({ unread: 0, conversations: [{ blocked: true, unread: false, lastMessage: null }] })

    const mineOut = await send(id, 'hello?', ada.token)
    expect(mineOut.body.message).toBe('You blocked this person. Unblock them to send a message.')
    // Bob isn't told he was blocked: it reads like closed messages.
    const theirs = await send(id, 'hello?', bob.token)
    expect(theirs.status).toBe(403)
    expect(theirs.body.message).toBe("This person isn't taking messages right now.")
    expect((await start('ada_dev', bob.token)).status).toBe(403)

    expect((await call('DELETE', '/api/blocks', { body: { handle: 'bob' }, token: ada.token })).body).toEqual({ blocked: false })
    expect((await send(id, 'back', bob.token)).status).toBe(201)
    expect((await read(id, ada.token)).body.messages).toHaveLength(4)
  })

  it('blocks by handle, never yourself, and not for demo accounts', async () => {
    expect((await call('POST', '/api/blocks', { body: { handle: 'cy' }, token: ada.token })).status).toBe(200)
    expect((await call('GET', '/api/messaging/with/cy', { token: ada.token })).body).toMatchObject({ blocked: true, reason: 'blocked' })
    expect((await call('POST', '/api/blocks', { body: { handle: 'ada_dev' }, token: ada.token })).status).toBe(400)
    expect((await call('POST', '/api/blocks', { body: { handle: 'cy' }, token: 'dev:demo' })).status).toBe(403)
    expect((await call('POST', '/api/blocks', { body: {}, token: ada.token })).status).toBe(400)
  })
})

describe('reports', () => {
  it('stores a report with the text, once, for a message I can see from someone else', async () => {
    const { id } = await talk()
    const theirs = (await send(id, 'buy cheap stuff', bob.token)).body.message
    const mine = (await send(id, 'no thanks', ada.token)).body.message
    const report = (body, token = ada.token) => call('POST', '/api/reports', { body, token })

    expect((await report({ kind: 'dm', messageId: theirs.id, reason: 'spam', note: 'Ads' })).status).toBe(201)
    expect((await report({ kind: 'dm', messageId: theirs.id, reason: 'spam' })).status).toBe(201)
    const stored = await store.listReports()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ reporterId: ada.id, reportedUserId: bob.id, kind: 'dm', reason: 'spam', note: 'Ads', snapshot: 'buy cheap stuff' })

    expect((await report({ kind: 'dm', messageId: mine.id, reason: 'spam' })).body.message).toBe("You can't report your own message.")
    expect((await report({ kind: 'dm', messageId: theirs.id, reason: 'spam' }, cy.token)).status).toBe(404)
    expect((await report({ kind: 'dm', messageId: theirs.id, reason: 'rude' })).body.message).toBe('Pick a reason for the report.')
    expect((await report({ kind: 'mail', messageId: theirs.id, reason: 'spam' })).status).toBe(400)
    expect((await report({ kind: 'dm', messageId: theirs.id, reason: 'other', note: 'x'.repeat(301) })).status).toBe(413)
    expect((await report({ kind: 'dm', messageId: theirs.id, reason: 'spam' }, 'dev:demo')).status).toBe(403)
  })
})

describe('limits and rules', () => {
  it('allows 20 messages a minute and 500 a day across chats, with a translated 429', async () => {
    const fake = { counts: new Map(), async addUsage(key) {
      const next = (this.counts.get(key) ?? 0) + 1
      this.counts.set(key, next)
      return next
    } }
    const user = { id: 'ada' }
    const at = new Date('2026-10-23T12:00:10Z')
    for (let n = 0; n < MESSAGE_LIMITS.perMinute; n++) await spendMessage(fake, user, at)
    await expect(spendMessage(fake, user, at)).rejects.toMatchObject({ status: 429, message: 'You can send 20 messages a minute. Wait a moment.' })
    // The next minute starts a new count; the day keeps adding up.
    await spendMessage(fake, user, new Date('2026-10-23T12:01:00Z'))
    fake.counts.set('messages:ada', MESSAGE_LIMITS.perDay)
    await expect(spendMessage(fake, user, new Date('2026-10-23T12:02:00Z'))).rejects.toMatchObject({
      status: 429,
      message: 'You can send 500 messages a day. Come back tomorrow.',
    })
  })

  it('answers the minute limit through the API', async () => {
    // Only the clock is fake, early in a minute, so the 21 sends can't straddle two minutes.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-23T12:00:05Z'))
    const { id } = await talk()
    for (let n = 0; n < MESSAGE_LIMITS.perMinute; n++) expect((await send(id, `m${n}`, ada.token)).status).toBe(201)
    const limited = await send(id, 'one more', ada.token)
    expect(limited.status).toBe(429)
    expect(limited.body.message).toBe('You can send 20 messages a minute. Wait a moment.')
  })

  it('parses bodies and cursors strictly', () => {
    expect(parseMessageBody({ body: '\u0007 hi\r\n there\t ' })).toBe('hi\n there')
    expect(() => parseMessageBody({})).toThrow('Invalid request.')
    expect(parseCursor({ after: '2026-10-23T12:00:00.123456+00:00' })).toEqual({ before: undefined, after: '2026-10-23T12:00:00.123456+00:00' })
    expect(() => parseCursor({ before: "2026-10-23'); drop" })).toThrow('Invalid request.')
  })

  it('works out who can message whom', async () => {
    expect(await messageBlocker(store, { id: ada.id, isDemo: false }, bob.id)).toBeNull()
    expect(await messageBlocker(store, { id: ada.id, isDemo: false }, ada.id)).toBe('self')
    expect(await messageBlocker(store, { id: 'demo', isDemo: true }, bob.id)).toBe('demo')
    const demo = await makeUser(store, 'demo-user', { isDemo: true })
    expect(await messageBlocker(store, { id: ada.id, isDemo: false }, demo.id)).toBe('unavailable')
    await store.addBlock(bob.id, ada.id)
    expect(await messageBlocker(store, { id: ada.id, isDemo: false }, bob.id)).toBe('unavailable')
    expect(await messageBlocker(store, { id: bob.id, isDemo: false }, ada.id)).toBe('blocked')
  })
})
