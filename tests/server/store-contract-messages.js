import { expect, it } from 'vitest'

// Direct messages, blocks, reports and communities: every store must pass these. storeContract
// calls this inside its describe, with a getter for the store and a maker of brand-new accounts
// (the Supabase database outlives each test, so nothing here relies on a clean slate).
const slugOf = (name) => `${name}-${crypto.randomUUID().slice(0, 8)}`
const COMMUNITY = { name: 'Café com JS', description: 'Async and coffee.', topics: ['javascript'], color: 'cobalt', icon: 'coffee' }

export function messagesStoreContract(getStore, newUser) {
  it('keeps who can message me, everyone by default, with the demo flag', async () => {
    const store = getStore()
    const user = await newUser()
    expect(await store.getMessaging(user.id)).toEqual({ allowMessages: 'everyone', isDemo: false })
    expect(await store.setMessagePolicy(user.id, 'nobody')).toBe('nobody')
    expect(await store.getMessaging(user.id)).toEqual({ allowMessages: 'nobody', isDemo: false })
    expect(await store.getMessaging(crypto.randomUUID())).toBeNull()
    expect(await store.setMessagePolicy(crypto.randomUUID(), 'nobody')).toBeNull()
  })

  it('blocks one way, says so from both sides, and unblocks', async () => {
    const store = getStore()
    const [ada, bob] = [await newUser(), await newUser()]
    expect(await store.blockState(ada.id, bob.id)).toEqual({ blocked: false, blockedBy: false })
    await store.addBlock(ada.id, bob.id)
    await store.addBlock(ada.id, bob.id)
    expect(await store.blockState(ada.id, bob.id)).toEqual({ blocked: true, blockedBy: false })
    expect(await store.blockState(bob.id, ada.id)).toEqual({ blocked: false, blockedBy: true })
    expect(await store.listBlockedIds(ada.id)).toEqual([bob.id])
    expect(await store.listBlockedIds(bob.id)).toEqual([])
    expect(await store.removeBlock(ada.id, bob.id)).toBe(true)
    expect(await store.removeBlock(ada.id, bob.id)).toBe(false)
    expect(await store.blockState(ada.id, bob.id)).toEqual({ blocked: false, blockedBy: false })
  })

  it('opens one conversation per pair and keeps an inbox with unread marks', async () => {
    const store = getStore()
    const [ada, bob, cy] = [await newUser(), await newUser(), await newUser()]
    expect(await store.findConversationBetween(ada.id, bob.id)).toBeNull()
    const opened = await store.openConversation(ada.id, bob.id)
    expect(opened).toMatchObject({ id: expect.any(String), memberIds: [ada.id, bob.id].sort(), lastMessageAt: null })
    expect(await store.openConversation(bob.id, ada.id)).toEqual(opened)
    expect(await store.findConversationBetween(bob.id, ada.id)).toEqual(opened)
    expect(await store.getConversation(opened.id)).toEqual(opened)
    expect(await store.getConversation('not-an-id')).toBeNull()
    // No messages yet: not in anyone's inbox.
    expect(await store.listConversations(bob.id)).toEqual([])

    const first = await store.createMessage(opened.id, ada.id, 'Hi Bo')
    expect(first).toEqual({ id: expect.any(String), conversationId: opened.id, senderId: ada.id, body: 'Hi Bo', createdAt: expect.any(String) })
    expect(await store.getMessage(first.id)).toEqual(first)
    expect(await store.getMessage('not-an-id')).toBeNull()
    expect(await store.countUnreadConversations(bob.id)).toBe(1)
    expect(await store.countUnreadConversations(ada.id)).toBe(0)

    const other = await store.openConversation(cy.id, bob.id)
    await store.createMessage(other.id, cy.id, 'x'.repeat(300))
    const inbox = await store.listConversations(bob.id)
    expect(inbox.map((item) => [item.id, item.unread])).toEqual([
      [other.id, true],
      [opened.id, true],
    ])
    expect(inbox[0].lastMessage).toMatchObject({ senderId: cy.id, createdAt: expect.any(String) })
    // The inbox keeps a preview, not the whole message.
    expect(inbox[0].lastMessage.body).toBe('x'.repeat(200))
    expect(inbox[1]).toMatchObject({ memberIds: [ada.id, bob.id].sort(), lastMessage: { senderId: ada.id, body: 'Hi Bo' }, lastReadAt: null })

    expect(await store.markConversationRead(opened.id, bob.id)).toBe(true)
    expect(await store.markConversationRead(opened.id, cy.id)).toBe(false)
    expect(await store.countUnreadConversations(bob.id)).toBe(1)
    expect((await store.listConversations(bob.id)).find((item) => item.id === opened.id)).toMatchObject({ unread: false, lastReadAt: expect.any(String) })

    // A reply marks it read for the sender, unread for the other person.
    await store.createMessage(opened.id, bob.id, 'Hey Ada')
    expect((await store.listConversations(ada.id))[0]).toMatchObject({ unread: true, lastMessage: { senderId: bob.id, body: 'Hey Ada' } })
    expect((await store.listConversations(bob.id)).find((item) => item.id === opened.id).unread).toBe(false)
  })

  it('pages messages oldest first with before and after cursors', async () => {
    const store = getStore()
    const [ada, bob] = [await newUser(), await newUser()]
    const { id } = await store.openConversation(ada.id, bob.id)
    const sent = []
    for (const body of ['one', 'two', 'three', 'four']) sent.push(await store.createMessage(id, ada.id, body))
    const bodies = (list) => list.map((item) => item.body)
    expect(bodies(await store.listMessages(id))).toEqual(['one', 'two', 'three', 'four'])
    expect(bodies(await store.listMessages(id, { limit: 2 }))).toEqual(['three', 'four'])
    expect(bodies(await store.listMessages(id, { before: sent[2].createdAt, limit: 5 }))).toEqual(['one', 'two'])
    expect(bodies(await store.listMessages(id, { after: sent[1].createdAt }))).toEqual(['three', 'four'])
    expect(bodies(await store.listMessages(id, { after: sent[0].createdAt, limit: 1 }))).toEqual(['two'])
    expect(await store.listMessages(id, { after: sent[3].createdAt })).toEqual([])
  })

  it('stores a report once per person and message, and lists open ones', async () => {
    const store = getStore()
    const [ada, bob] = [await newUser(), await newUser()]
    const messageId = crypto.randomUUID()
    const fields = { reporterId: ada.id, reportedUserId: bob.id, kind: 'dm', messageId, reason: 'spam', note: 'Ads', snapshot: 'buy now' }
    const created = await store.createReport(fields)
    expect(created).toMatchObject({ ...fields, id: expect.any(String), status: 'open', createdAt: expect.any(String) })
    expect(await store.createReport(fields)).toBeNull()
    expect(await store.createReport({ ...fields, kind: 'community' })).toMatchObject({ kind: 'community' })
    const open = await store.listReports(500)
    expect(open.filter((item) => item.messageId === messageId).map((item) => item.kind)).toEqual(['community', 'dm'])
  })

  it('creates communities with unique slugs, the owner as first member', async () => {
    const store = getStore()
    const owner = await newUser()
    const slug = slugOf('cafe')
    const created = await store.createCommunity(owner.id, { ...COMMUNITY, slug })
    expect(created).toEqual({ id: expect.any(String), slug, ...COMMUNITY, isPrivate: false, ownerId: owner.id, memberCount: 1, createdAt: expect.any(String) })
    expect(await store.createCommunity(owner.id, { ...COMMUNITY, slug })).toBeNull()
    expect(await store.getCommunity(slug)).toEqual(created)
    expect(await store.getCommunityById(created.id)).toEqual(created)
    expect(await store.getCommunity('no-such-slug-here')).toBeNull()
    expect(await store.getCommunityById('not-an-id')).toBeNull()
    expect(await store.countOwnedCommunities(owner.id)).toBe(1)
    expect(await store.getCommunityMember(created.id, owner.id)).toMatchObject({ userId: owner.id, role: 'owner' })
    expect((await store.listUserCommunities(owner.id)).map((item) => item.id)).toEqual([created.id])
  })

  it('joins, leaves and removes members, keeping the count', async () => {
    const store = getStore()
    const [owner, bob, cy] = [await newUser(), await newUser(), await newUser()]
    const community = await store.createCommunity(owner.id, { ...COMMUNITY, slug: slugOf('club') })
    expect(await store.joinCommunity(community.id, bob.id)).toMatchObject({ userId: bob.id, role: 'member' })
    expect(await store.joinCommunity(community.id, bob.id)).toMatchObject({ role: 'member' })
    await store.joinCommunity(community.id, cy.id)
    expect((await store.getCommunityById(community.id)).memberCount).toBe(3)
    expect((await store.listCommunityMembers(community.id)).map((item) => [item.userId, item.role])).toEqual([
      [owner.id, 'owner'],
      [bob.id, 'member'],
      [cy.id, 'member'],
    ])

    expect(await store.leaveCommunity(community.id, owner.id)).toBe(false)
    expect(await store.leaveCommunity(community.id, cy.id)).toBe(true)
    expect(await store.getCommunityMember(community.id, cy.id)).toBeNull()
    expect(await store.removeCommunityMember(community.id, bob.id)).toBe(true)
    expect(await store.removeCommunityMember(community.id, owner.id)).toBe(false)
    expect(await store.getCommunityMember(community.id, bob.id)).toMatchObject({ role: 'removed' })
    // Someone removed stays removed.
    expect(await store.joinCommunity(community.id, bob.id)).toMatchObject({ role: 'removed' })
    expect((await store.getCommunityById(community.id)).memberCount).toBe(1)
    expect((await store.listCommunityMembers(community.id)).map((item) => item.userId)).toEqual([owner.id])
    expect(await store.listUserCommunities(bob.id)).toEqual([])
  })

  it('searches communities by name, description or topic, most members first', async () => {
    const store = getStore()
    const [owner, bob] = [await newUser(), await newUser()]
    const word = `w${crypto.randomUUID().slice(0, 8)}`
    const small = await store.createCommunity(owner.id, { ...COMMUNITY, name: `Small ${word}`, topics: ['python'], slug: slugOf('small') })
    const big = await store.createCommunity(owner.id, { ...COMMUNITY, name: 'Big one', description: `About ${word}`, topics: ['backend'], slug: slugOf('big') })
    await store.joinCommunity(big.id, bob.id)
    const found = await store.searchCommunities({ q: word, limit: 10 })
    expect(found).toEqual({ communities: [expect.objectContaining({ id: big.id, memberCount: 2 }), expect.objectContaining({ id: small.id })], hasMore: false })
    expect((await store.searchCommunities({ q: word, limit: 1 })).hasMore).toBe(true)
    expect((await store.searchCommunities({ q: word, topic: 'python', limit: 10 })).communities.map((item) => item.id)).toEqual([small.id])
  })

  it('keeps a community chat with cursors and deletes one message', async () => {
    const store = getStore()
    const owner = await newUser()
    const community = await store.createCommunity(owner.id, { ...COMMUNITY, slug: slugOf('chat') })
    const one = await store.createCommunityMessage(community.id, owner.id, 'one')
    expect(one).toEqual({ id: expect.any(String), communityId: community.id, senderId: owner.id, body: 'one', createdAt: expect.any(String) })
    const two = await store.createCommunityMessage(community.id, owner.id, 'two')
    expect(await store.getCommunityMessage(two.id)).toEqual(two)
    expect((await store.listCommunityMessages(community.id)).map((item) => item.body)).toEqual(['one', 'two'])
    expect((await store.listCommunityMessages(community.id, { after: one.createdAt })).map((item) => item.body)).toEqual(['two'])
    expect((await store.listCommunityMessages(community.id, { before: two.createdAt })).map((item) => item.body)).toEqual(['one'])
    expect(await store.deleteCommunityMessage(one.id)).toBe(true)
    expect(await store.deleteCommunityMessage(one.id)).toBe(false)
    expect(await store.getCommunityMessage(one.id)).toBeNull()
  })

  it('announces a new message once until it is read', async () => {
    const store = getStore()
    const [ada, bob] = [await newUser(), await newUser()]
    expect(await store.addNotification({ userId: bob.id, type: 'message', actorId: ada.id })).toMatchObject({ type: 'message', read: false })
    expect(await store.addNotification({ userId: bob.id, type: 'message', actorId: ada.id })).toBeNull()
    await store.markNotificationsRead(bob.id)
    expect(await store.addNotification({ userId: bob.id, type: 'message', actorId: ada.id })).toMatchObject({ type: 'message' })
    expect(await store.countUnreadNotifications(bob.id)).toBe(1)
  })
}
