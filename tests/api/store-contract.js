import { beforeEach, describe, expect, it } from 'vitest'

// Every store (local file, Supabase) must pass these. Not a test file itself: suites import it.
export const CASE = {
  error: 'TypeError: x is undefined',
  code: 'x.y',
  analysis: { explicacao: 'a', causa: 'b', correcao: 'c', exercicio: { enunciado: 'd', resposta: 'e' } },
  concept: 'undefined-access',
  language: 'javascript',
}

export const challengeFor = (caseId) => ({
  caseId,
  brokenCode: 'const a = {}\nconsole.log(a.b.c)',
  symptom: "TypeError: Cannot read properties of undefined (reading 'c')",
  language: 'javascript',
  hints: ['Look at a.b', 'What is a.b right now?', 'Check a.b before reading .c'],
})

export const SECRET = { solution: 'console.log(a.b?.c)', bugExplanation: 'a.b is undefined' }

// What a profile's "About you" holds before anything is picked, and a filled-in one.
export const EMPTY_ABOUT = {
  role: null,
  headline: '',
  university: '',
  course: '',
  work: '',
  location: '',
  languages: [],
  links: {},
  openTo: [],
}
export const ABOUT = {
  role: 'student',
  headline: 'Learning React at night',
  university: 'Infnet',
  course: 'Software Engineering',
  work: 'Support analyst at Acme',
  location: 'Rio de Janeiro',
  languages: ['javascript', 'python'],
  links: { github: 'https://github.com/ada', website: 'https://ada.dev/' },
  openTo: ['study-buddies', 'internships'],
}

export function storeContract(label, makeStore, ids = { alice: 'alice', bob: 'bob' }) {
  describe(`${label} store`, () => {
    let store

    beforeEach(async () => {
      store = await makeStore()
    })

    it('creates a case as new with zero passes', async () => {
      const created = await store.createCase(ids.alice, CASE)
      expect(created).toMatchObject({ ...CASE, userId: ids.alice, status: 'new', passedCount: 0 })
      expect(created.id).toEqual(expect.any(String))
      expect(created.createdAt).toEqual(expect.any(String))
    })

    it("lists only the owner's cases, newest first", async () => {
      const first = await store.createCase(ids.alice, CASE)
      await store.createCase(ids.bob, CASE)
      const second = await store.createCase(ids.alice, { ...CASE, error: 'ReferenceError: y is not defined' })
      expect((await store.listCases(ids.alice)).map((item) => item.id)).toEqual([second.id, first.id])
    })

    it("hides another user's case", async () => {
      const created = await store.createCase(ids.alice, CASE)
      expect(await store.getCase(ids.bob, created.id)).toBeNull()
      expect(await store.updateCase(ids.bob, created.id, { status: 'solved' })).toBeNull()
      expect((await store.getCase(ids.alice, created.id)).status).toBe('new')
    })

    it('updates status and pass count', async () => {
      const created = await store.createCase(ids.alice, CASE)
      const updated = await store.updateCase(ids.alice, created.id, { status: 'training', passedCount: 1 })
      expect(updated).toMatchObject({ id: created.id, status: 'training', passedCount: 1 })
      expect(await store.getCase(ids.alice, created.id)).toMatchObject({ status: 'training', passedCount: 1 })
    })

    it('keeps the challenge secret apart', async () => {
      const kase = await store.createCase(ids.alice, CASE)
      const challenge = await store.createChallenge(ids.alice, challengeFor(kase.id), SECRET)
      expect(challenge).toMatchObject({ ...challengeFor(kase.id), userId: ids.alice, hintsRevealed: 0, status: 'open', attempts: 0 })
      expect(challenge).not.toHaveProperty('solution')
      expect(await store.getChallenge(ids.alice, challenge.id)).toEqual(challenge)
      expect(await store.getChallenge(ids.bob, challenge.id)).toBeNull()
      expect(await store.getChallengeSecret(challenge.id)).toEqual(SECRET)
    })

    it('finds the open challenge for a case', async () => {
      const kase = await store.createCase(ids.alice, CASE)
      const challenge = await store.createChallenge(ids.alice, challengeFor(kase.id), SECRET)
      expect((await store.findOpenChallenge(ids.alice, kase.id)).id).toBe(challenge.id)
      expect(await store.findOpenChallenge(ids.bob, kase.id)).toBeNull()
      await store.updateChallenge(ids.alice, challenge.id, { status: 'passed', attempts: 1, hintsRevealed: 2 })
      expect(await store.getChallenge(ids.alice, challenge.id)).toMatchObject({ status: 'passed', attempts: 1, hintsRevealed: 2 })
      expect(await store.findOpenChallenge(ids.alice, kase.id)).toBeNull()
    })

    it('creates a user and finds them by email in any case', async () => {
      const email = `Ada.${crypto.randomUUID()}@Example.com`
      const user = await store.createUser({ email, passwordHash: 'scrypt$aa$bb', isDemo: false })
      expect(user).toMatchObject({ email: email.toLowerCase(), passwordHash: 'scrypt$aa$bb', isDemo: false })
      expect(user.id).toEqual(expect.any(String))
      expect(await store.findUserByEmail(email.toUpperCase())).toEqual(user)
      expect(await store.findUserByEmail('nobody@example.com')).toBeNull()
    })

    it('refuses a second account with the same email', async () => {
      const email = `twice.${crypto.randomUUID()}@example.com`
      await store.createUser({ email, passwordHash: 'scrypt$aa$bb', isDemo: false })
      expect(await store.createUser({ email: email.toUpperCase(), passwordHash: 'scrypt$cc$dd', isDemo: false })).toBeNull()
    })

    it("lists the owner's challenges", async () => {
      const kase = await store.createCase(ids.alice, CASE)
      const challenge = await store.createChallenge(ids.alice, challengeFor(kase.id), SECRET)
      expect((await store.listChallenges(ids.alice)).map((item) => item.id)).toEqual([challenge.id])
      expect(await store.listChallenges(ids.bob)).toEqual([])
      expect((await store.listChallenges(ids.alice))[0]).not.toHaveProperty('solution')
    })

    it('creates, lists, updates and deletes notes for their owner only', async () => {
      const kase = await store.createCase(ids.alice, CASE)
      const blocks = [
        { type: 'text', text: 'Why did this happen?' },
        { type: 'case', caseId: kase.id },
      ]
      const note = await store.createNote(ids.alice, { title: 'Undefined', blocks })
      expect(note).toMatchObject({ userId: ids.alice, title: 'Undefined', blocks })
      expect(note.id).toEqual(expect.any(String))
      expect(note.updatedAt).toEqual(expect.any(String))

      const other = await store.createNote(ids.alice, { title: 'Second', blocks: [] })
      expect((await store.listNotes(ids.alice)).map((item) => item.id)).toEqual([other.id, note.id])
      expect(await store.listNotes(ids.bob)).toEqual([])
      expect(await store.getNote(ids.bob, note.id)).toBeNull()
      expect(await store.updateNote(ids.bob, note.id, { title: 'Mine now' })).toBeNull()

      const updated = await store.updateNote(ids.alice, note.id, { title: 'Reading undefined', blocks: [] })
      expect(updated).toMatchObject({ id: note.id, title: 'Reading undefined', blocks: [] })
      expect(await store.getNote(ids.alice, note.id)).toMatchObject({ title: 'Reading undefined' })
      // The note just edited moves to the top.
      expect((await store.listNotes(ids.alice))[0].id).toBe(note.id)

      expect(await store.deleteNote(ids.bob, note.id)).toBe(false)
      expect(await store.deleteNote(ids.alice, note.id)).toBe(true)
      expect(await store.getNote(ids.alice, note.id)).toBeNull()
    })

    it('adds study time per day up to a daily cap', async () => {
      expect(await store.addStudyTime(ids.alice, '2026-10-21', 60, 100)).toBe(60)
      expect(await store.addStudyTime(ids.alice, '2026-10-21', 60, 100)).toBe(100)
      expect(await store.addStudyTime(ids.alice, '2026-10-22', 30, 100)).toBe(30)
      expect(await store.addStudyTime(ids.bob, '2026-10-22', 5, 100)).toBe(5)
      expect(await store.listStudyTime(ids.alice)).toEqual([
        { day: '2026-10-21', seconds: 100 },
        { day: '2026-10-22', seconds: 30 },
      ])
    })

    it('counts usage per key per day', async () => {
      expect(await store.countUsage(ids.alice, '2026-10-21')).toBe(0)
      expect(await store.addUsage(ids.alice, '2026-10-21')).toBe(1)
      expect(await store.addUsage(ids.alice, '2026-10-21')).toBe(2)
      expect(await store.countUsage(ids.alice, '2026-10-22')).toBe(0)
      expect(await store.countUsage(ids.bob, '2026-10-21')).toBe(0)
    })

    // Profiles live on real accounts, so these tests make their own users.
    const newUser = () =>
      store.createUser({ email: `profile-${crypto.randomUUID()}@glitch.test`, passwordHash: null, isDemo: false })
    // Handles are unique across the whole store, and the Supabase one outlives each test.
    const uniqueHandle = (name) => `${name}-${crypto.randomUUID().slice(0, 8)}`

    it('starts every profile empty and private', async () => {
      const user = await newUser()
      expect(await store.getProfile(user.id)).toEqual({
        handle: null,
        displayName: null,
        bio: '',
        avatar: null,
        featuredBadges: [],
        isPublic: false,
        ...EMPTY_ABOUT,
        createdAt: user.createdAt,
      })
      expect(await store.getProfile(crypto.randomUUID())).toBeNull()
    })

    it('updates only the profile fields given', async () => {
      const user = await newUser()
      const handle = uniqueHandle('ada')
      const first = await store.updateProfile(user.id, { handle, displayName: 'Ada', avatar: { seed: 'abc', color: 'cobalt' } })
      expect(first.profile).toMatchObject({ handle, displayName: 'Ada', avatar: { seed: 'abc', color: 'cobalt' }, bio: '', isPublic: false })

      const second = await store.updateProfile(user.id, { bio: 'Fixing bugs.', featuredBadges: ['first-clue'], isPublic: true })
      expect(second.profile).toMatchObject({ handle, displayName: 'Ada', bio: 'Fixing bugs.', featuredBadges: ['first-clue'], isPublic: true })
      expect(await store.getProfile(user.id)).toEqual(second.profile)

      // null clears a field back to "not chosen yet".
      expect((await store.updateProfile(user.id, { displayName: null })).profile.displayName).toBeNull()
      expect(await store.updateProfile(crypto.randomUUID(), { bio: 'x' })).toBeNull()
    })

    it('refuses a handle someone else has, in any case', async () => {
      const ada = await newUser()
      const bob = await newUser()
      const handle = uniqueHandle('taken')
      await store.updateProfile(ada.id, { handle })
      expect(await store.updateProfile(bob.id, { handle: handle.toUpperCase(), bio: 'mine' })).toEqual({ conflict: 'handle' })
      expect((await store.getProfile(bob.id)).bio).toBe('')
      // Saving your own handle again is fine.
      expect((await store.updateProfile(ada.id, { handle })).profile.handle).toBe(handle)
    })

    it('finds a profile by handle only while it is public', async () => {
      const user = await newUser()
      const handle = uniqueHandle('pub')
      await store.updateProfile(user.id, { handle, displayName: 'Pub' })
      expect(await store.findPublicProfile(handle)).toBeNull()

      await store.updateProfile(user.id, { isPublic: true })
      const found = await store.findPublicProfile(handle.toUpperCase())
      expect(found).toEqual({ userId: user.id, profile: await store.getProfile(user.id) })
      expect(found.profile).not.toHaveProperty('email')
      expect(await store.findPublicProfile(uniqueHandle('nobody'))).toBeNull()
    })

    it('saves the about-you fields and changes only the ones given', async () => {
      const user = await newUser()
      const { profile } = await store.updateProfile(user.id, ABOUT)
      expect(profile).toMatchObject(ABOUT)
      expect(await store.getProfile(user.id)).toEqual(profile)

      const next = await store.updateProfile(user.id, { headline: 'Now teaching', links: {}, role: null })
      expect(next.profile).toMatchObject({ ...ABOUT, headline: 'Now teaching', links: {}, role: null })
    })

    it('finds public profiles by handle or name, never private ones', async () => {
      const tag = crypto.randomUUID().slice(0, 6)
      const make = async (handle, displayName, isPublic) => {
        const user = await newUser()
        await store.updateProfile(user.id, { handle, displayName, isPublic })
        return user
      }
      const ada = await make(`ada-${tag}`, 'Ada Lovelace', true)
      // Found by name only: the handle doesn't have the tag.
      const grace = await make(uniqueHandle('grace'), `Grace ${tag.toUpperCase()}`, true)
      await make(`hidden-${tag}`, 'Hidden', false)

      const found = await store.searchPublicProfiles(tag, 20)
      expect(found.map((item) => item.userId).sort()).toEqual([ada.id, grace.id].sort())
      expect(found.find((item) => item.userId === ada.id).profile).toEqual(await store.getProfile(ada.id))
      expect((await store.searchPublicProfiles(`ADA-${tag}`, 20)).map((item) => item.userId)).toEqual([ada.id])
      expect(await store.searchPublicProfiles(tag, 1)).toHaveLength(1)
      expect(await store.searchPublicProfiles(`zz-${crypto.randomUUID()}`, 20)).toEqual([])
      // Search characters are plain text, never wildcards.
      expect(await store.searchPublicProfiles(`%${tag}`, 20)).toEqual([])
    })

    it('keeps notes private until marked public', async () => {
      const note = await store.createNote(ids.alice, { title: 'Shy', blocks: [] })
      expect(note.isPublic).toBe(false)
      const shared = await store.createNote(ids.alice, { title: 'Loud', blocks: [], isPublic: true })
      expect(shared.isPublic).toBe(true)

      expect(await store.updateNote(ids.bob, note.id, { isPublic: true })).toBeNull()
      const updated = await store.updateNote(ids.alice, note.id, { isPublic: true })
      expect(updated).toMatchObject({ title: 'Shy', isPublic: true })
      expect((await store.updateNote(ids.alice, note.id, { title: 'Still shy' })).isPublic).toBe(true)
      expect((await store.getNote(ids.alice, note.id)).isPublic).toBe(true)
      expect((await store.listNotes(ids.alice)).every((item) => typeof item.isPublic === 'boolean')).toBe(true)
    })

    const trailFor = (caseId) => ({
      title: 'Beat undefined',
      summary: 'Your weak spot first.',
      missions: [
        { id: 'm1', kind: 'train', title: 'Train it', description: 'Pass a challenge.', caseId, xp: 40 },
        { id: 'm2', kind: 'reflect', title: 'Think', description: 'Say why.', xp: 10 },
      ],
    })

    it('creates and lists study trails for their owner only, newest first', async () => {
      const kase = await store.createCase(ids.alice, CASE)
      const first = await store.createTrail(ids.alice, trailFor(kase.id))
      expect(first).toMatchObject({ ...trailFor(kase.id), userId: ids.alice, done: [] })
      expect(first.id).toEqual(expect.any(String))
      expect(first.createdAt).toEqual(expect.any(String))

      await new Promise((resolve) => setTimeout(resolve, 5))
      const second = await store.createTrail(ids.alice, { ...trailFor(kase.id), title: 'Second' })
      expect((await store.listTrails(ids.alice)).map((trail) => trail.id)).toEqual([second.id, first.id])
      expect(await store.listTrails(ids.bob)).toEqual([])
      expect(await store.getTrail(ids.alice, first.id)).toEqual(first)
      expect(await store.getTrail(ids.bob, first.id)).toBeNull()
    })

    it('keeps a given start time, so a trail can begin in the past', async () => {
      const kase = await store.createCase(ids.alice, CASE)
      const createdAt = '2026-10-19T00:00:00.000Z'
      const trail = await store.createTrail(ids.alice, { ...trailFor(kase.id), createdAt })
      expect(new Date(trail.createdAt).toISOString()).toBe(createdAt)
      const newer = await store.createTrail(ids.alice, trailFor(kase.id))
      expect((await store.listTrails(ids.alice)).map((item) => item.id)).toEqual([newer.id, trail.id])
    })

    it('marks a mission done and undone, only on my own trail', async () => {
      const kase = await store.createCase(ids.alice, CASE)
      const trail = await store.createTrail(ids.alice, trailFor(kase.id))
      expect((await store.setMissionDone(ids.alice, trail.id, 'm2', true)).done).toEqual(['m2'])
      // Ticking twice keeps one entry.
      expect((await store.setMissionDone(ids.alice, trail.id, 'm2', true)).done).toEqual(['m2'])
      expect(await store.setMissionDone(ids.bob, trail.id, 'm2', false)).toBeNull()
      expect((await store.getTrail(ids.alice, trail.id)).done).toEqual(['m2'])
      expect(await store.setMissionDone(ids.alice, trail.id, 'nope', true)).toBeNull()
      expect((await store.setMissionDone(ids.alice, trail.id, 'm2', false)).done).toEqual([])
      expect(await store.setMissionDone(ids.alice, crypto.randomUUID(), 'm2', true)).toBeNull()
    })
  })
}
