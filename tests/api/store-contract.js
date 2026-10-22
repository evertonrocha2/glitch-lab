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

    // Puzzles are shared by everyone and the Supabase table outlives each test, so each test
    // picks a far-future day of its own.
    it('keeps a puzzle secret apart and allows one puzzle per slot', async () => {
      const day = randomDay()
      const puzzle = await store.createPuzzle(puzzleFor(day), PUZZLE_SECRET)
      expect(puzzle).toMatchObject(puzzleFor(day))
      expect(puzzle.id).toEqual(expect.any(String))
      expect(puzzle).not.toHaveProperty('solution')
      expect(await store.getPuzzle(puzzle.id)).toEqual(puzzle)
      expect(await store.getPuzzleSecret(puzzle.id)).toEqual(PUZZLE_SECRET)
      expect(await store.createPuzzle(puzzleFor(day, { title: 'Second try' }), PUZZLE_SECRET)).toBeNull()
      expect(await store.getPuzzle(crypto.randomUUID())).toBeNull()
      expect(await store.getPuzzle('not-an-id')).toBeNull()
    })

    it('lists puzzles by kind, day, start day or ids', async () => {
      const day = randomDay()
      const easy = await store.createPuzzle(puzzleFor(day), PUZZLE_SECRET)
      const hard = await store.createPuzzle(puzzleFor(day, { difficulty: 'hard' }), PUZZLE_SECRET)
      const global = await store.createPuzzle(puzzleFor(day, { kind: 'global', difficulty: 'hard' }), PUZZLE_SECRET)
      const before = await store.createPuzzle(puzzleFor(`${day.slice(0, 8)}01`), PUZZLE_SECRET)
      const ids = (list) => list.map((item) => item.id)

      expect(ids(await store.listPuzzles({ kind: 'daily', day })).sort()).toEqual([easy.id, hard.id].sort())
      expect(ids(await store.listPuzzles({ kind: 'global', day }))).toEqual([global.id])
      const since = ids(await store.listPuzzles({ kind: 'daily', since: day }))
      expect(since).toEqual(expect.arrayContaining([easy.id, hard.id]))
      expect(since).not.toContain(before.id)
      expect(since).not.toContain(global.id)
      expect(ids(await store.listPuzzles({ ids: [hard.id, before.id] })).sort()).toEqual([hard.id, before.id].sort())
      expect(await store.listPuzzles({ ids: [] })).toEqual([])
      expect((await store.listPuzzles({ day }))[0]).not.toHaveProperty('solution')
    })

    it('starts one challenge per user per puzzle', async () => {
      const puzzle = await store.createPuzzle(puzzleFor(randomDay()), PUZZLE_SECRET)
      const fields = { caseId: null, puzzleId: puzzle.id, brokenCode: puzzle.brokenCode, symptom: puzzle.symptom, language: puzzle.language, hints: puzzle.hints }
      const challenge = await store.createChallenge(ids.alice, fields, PUZZLE_SECRET)
      expect(challenge).toMatchObject({ ...fields, userId: ids.alice, status: 'open', attempts: 0, passedAt: null })
      expect(await store.createChallenge(ids.alice, fields, PUZZLE_SECRET)).toBeNull()
      expect(await store.findPuzzleChallenge(ids.alice, puzzle.id)).toEqual(challenge)
      expect(await store.findPuzzleChallenge(ids.bob, puzzle.id)).toBeNull()
      expect(await store.getChallengeSecret(challenge.id)).toEqual(PUZZLE_SECRET)

      const passed = await store.updateChallenge(ids.alice, challenge.id, { status: 'passed', attempts: 2 })
      expect(passed.passedAt).toEqual(expect.any(String))
      // Later updates keep the first pass time.
      expect((await store.updateChallenge(ids.alice, challenge.id, { hintsRevealed: 1 })).passedAt).toBe(passed.passedAt)
    })

    it('lists who passed a puzzle, with attempts and times', async () => {
      const puzzle = await store.createPuzzle(puzzleFor(randomDay()), PUZZLE_SECRET)
      const start = (userId) =>
        store.createChallenge(userId, { caseId: null, puzzleId: puzzle.id, brokenCode: 'x', symptom: 'y', language: 'python', hints: ['a', 'b', 'c'] }, PUZZLE_SECRET)
      const mine = await start(ids.alice)
      await start(ids.bob)
      expect(await store.puzzleSolves(puzzle.id)).toEqual([])

      await store.updateChallenge(ids.alice, mine.id, { status: 'passed', attempts: 3 })
      const solves = await store.puzzleSolves(puzzle.id)
      expect(solves).toEqual([{ userId: ids.alice, attempts: 3, startedAt: mine.createdAt, passedAt: expect.any(String) }])
      expect(Date.parse(solves[0].passedAt)).toBeGreaterThanOrEqual(Date.parse(solves[0].startedAt))
    })

    // Community articles are shared by everyone and outlive each test on Supabase,
    // so every search here narrows itself with a tag or word made up for that test.
    const marker = () => `m${crypto.randomUUID().slice(0, 8)}`
    const article = (fields = {}) => ({ title: 'Undefined everywhere', body: 'Check before reading.', tags: ['javascript'], caseId: null, ...fields })
    const idsOf = (list) => list.map((item) => item.id)

    it('creates, reads, updates and deletes an article for its author only', async () => {
      const kase = await store.createCase(ids.alice, CASE)
      const created = await store.createArticle(ids.alice, article({ caseId: kase.id }))
      expect(created).toMatchObject({
        ...article({ caseId: kase.id }),
        authorId: ids.alice,
        likeCount: 0,
        validCount: 0,
        badCount: 0,
        commentCount: 0,
      })
      expect(created.id).toEqual(expect.any(String))
      expect(created.updatedAt).toEqual(expect.any(String))
      expect(await store.getArticle(created.id)).toEqual(created)
      expect(await store.getArticle(crypto.randomUUID())).toBeNull()

      expect(await store.updateArticle(ids.bob, created.id, { title: 'Mine now' })).toBeNull()
      const updated = await store.updateArticle(ids.alice, created.id, { title: 'Reading undefined', tags: ['js', 'bugs'], caseId: null })
      expect(updated).toMatchObject({ id: created.id, title: 'Reading undefined', body: 'Check before reading.', tags: ['js', 'bugs'], caseId: null })
      expect(await store.getArticle(created.id)).toEqual(updated)

      expect(await store.deleteArticle(ids.bob, created.id)).toBe(false)
      expect(await store.deleteArticle(ids.alice, created.id)).toBe(true)
      expect(await store.getArticle(created.id)).toBeNull()
    })

    it('keeps comments in order and counts them on the article', async () => {
      const created = await store.createArticle(ids.alice, article())
      const first = await store.createComment(ids.bob, created.id, 'Great tip.')
      const second = await store.createComment(ids.alice, created.id, 'Thanks!')
      expect(first).toMatchObject({ articleId: created.id, authorId: ids.bob, body: 'Great tip.' })
      expect(first.createdAt).toEqual(expect.any(String))
      expect(idsOf(await store.listComments(created.id))).toEqual([first.id, second.id])
      expect(await store.getComment(first.id)).toEqual(first)
      expect((await store.getArticle(created.id)).commentCount).toBe(2)

      expect(await store.deleteComment(first.id)).toBe(true)
      expect(await store.deleteComment(first.id)).toBe(false)
      expect(await store.getComment(first.id)).toBeNull()
      expect((await store.getArticle(created.id)).commentCount).toBe(1)
    })

    it('keeps one like and one rating per person, with counts', async () => {
      const created = await store.createArticle(ids.alice, article())
      expect(await store.getReaction(created.id, ids.bob)).toEqual({ liked: false, rating: null })

      expect(await store.setReaction(created.id, ids.bob, { liked: true })).toEqual({ liked: true, rating: null })
      expect(await store.setReaction(created.id, ids.bob, { rating: 'valid' })).toEqual({ liked: true, rating: 'valid' })
      expect(await store.getArticle(created.id)).toMatchObject({ likeCount: 1, validCount: 1, badCount: 0 })

      // Changing the rating moves it; it never counts twice.
      await store.setReaction(created.id, ids.bob, { rating: 'bad' })
      expect(await store.getArticle(created.id)).toMatchObject({ likeCount: 1, validCount: 0, badCount: 1 })

      expect(await store.setReaction(created.id, ids.bob, { liked: false, rating: null })).toEqual({ liked: false, rating: null })
      expect(await store.getReaction(created.id, ids.bob)).toEqual({ liked: false, rating: null })
      expect(await store.getArticle(created.id)).toMatchObject({ likeCount: 0, validCount: 0, badCount: 0 })
    })

    it("sums what an author's articles received, leaving out demo reactions", async () => {
      const writer = await newUser()
      const before = await store.communityStats(writer.id)
      expect(before).toEqual({ articles: 0, likesReceived: 0, validReceived: 0, comments: 0 })

      const one = await store.createArticle(writer.id, article())
      const two = await store.createArticle(writer.id, article({ title: 'Second' }))
      await store.setReaction(one.id, ids.alice, { liked: true, rating: 'valid' })
      await store.setReaction(two.id, ids.alice, { liked: true, rating: 'bad' })
      await store.setReaction(two.id, ids.bob, { liked: true, rating: 'valid', fromDemo: true })
      await store.createComment(writer.id, one.id, 'Edit: fixed a typo.')
      await store.createComment(ids.alice, one.id, 'Nice.')

      expect(await store.communityStats(writer.id)).toEqual({ articles: 2, likesReceived: 2, validReceived: 1, comments: 1 })
      // The demo reaction still shows on the article itself.
      expect(await store.getArticle(two.id)).toMatchObject({ likeCount: 2, validCount: 1, badCount: 1 })
    })

    it('searches articles by words, tag and author, newest first, a page at a time', async () => {
      const tag = marker()
      const word = marker()
      const writer = await newUser()
      const handle = uniqueHandle('writer')
      await store.updateProfile(writer.id, { handle, displayName: `Writer ${word}` })

      const old = await store.createArticle(ids.alice, article({ title: `Old ${word} post`, tags: [tag] }))
      const inBody = await store.createArticle(ids.alice, article({ title: 'Plain', body: `The ${word.toUpperCase()} trick`, tags: [tag] }))
      const byWriter = await store.createArticle(writer.id, article({ title: 'By the writer', tags: [tag, 'python'] }))
      const tagged = await store.createArticle(ids.bob, article({ title: 'Tag only', tags: [word] }))

      const search = (params) => store.searchArticles({ sort: 'new', offset: 0, limit: 10, ...params })
      expect(idsOf((await search({ tag })).articles)).toEqual([byWriter.id, inBody.id, old.id])
      // Words match the title, body, an exact tag, or the author's name.
      expect(idsOf((await search({ q: word })).articles)).toEqual([tagged.id, byWriter.id, inBody.id, old.id])
      expect(idsOf((await search({ q: handle.toUpperCase(), tag })).articles)).toEqual([byWriter.id])
      expect(idsOf((await search({ authorHandle: handle })).articles)).toEqual([byWriter.id])
      expect((await search({ authorHandle: uniqueHandle('nobody') })).articles).toEqual([])
      expect((await search({ q: marker() })).articles).toEqual([])

      const first = await search({ tag, limit: 2 })
      expect(first).toEqual({ articles: expect.any(Array), hasMore: true })
      expect(idsOf(first.articles)).toEqual([byWriter.id, inBody.id])
      const second = await search({ tag, offset: 2, limit: 2 })
      expect(second.hasMore).toBe(false)
      expect(idsOf(second.articles)).toEqual([old.id])
    })

    it('sorts by likes or valid ratings', async () => {
      const tag = marker()
      const quiet = await store.createArticle(ids.alice, article({ tags: [tag] }))
      const liked = await store.createArticle(ids.alice, article({ tags: [tag] }))
      const trusted = await store.createArticle(ids.alice, article({ tags: [tag] }))
      await store.setReaction(liked.id, ids.bob, { liked: true })
      await store.setReaction(trusted.id, ids.bob, { rating: 'valid' })

      const sorted = async (sort) => idsOf((await store.searchArticles({ tag, sort, offset: 0, limit: 10 })).articles)
      expect(await sorted('top')).toEqual([liked.id, trusted.id, quiet.id])
      expect(await sorted('valid')).toEqual([trusted.id, liked.id, quiet.id])
    })

    it('loads many profiles at once by id', async () => {
      const ada = await newUser()
      const bo = await newUser()
      await store.updateProfile(ada.id, { displayName: 'Ada' })
      const profiles = await store.getProfiles([ada.id, bo.id, ada.id, crypto.randomUUID()])
      expect(Object.keys(profiles).sort()).toEqual([ada.id, bo.id].sort())
      expect(profiles[ada.id]).toEqual(await store.getProfile(ada.id))
      expect(await store.getProfiles([])).toEqual({})
    })

    it('keeps notifications per person, without repeats of the same like or rating', async () => {
      const created = await store.createArticle(ids.alice, article({ title: 'Undefined everywhere' }))
      const note = { userId: ids.alice, actorId: ids.bob, articleId: created.id }
      const liked = await store.addNotification({ ...note, type: 'like' })
      expect(liked).toMatchObject({ ...note, type: 'like', read: false })
      expect(await store.addNotification({ ...note, type: 'like' })).toBeNull()
      const commented = await store.addNotification({ ...note, type: 'comment' })
      const again = await store.addNotification({ ...note, type: 'comment' })
      expect(again).not.toBeNull()

      const listed = await store.listNotifications(ids.alice)
      expect(idsOf(listed)).toEqual([again.id, commented.id, liked.id])
      expect(listed[0].articleTitle).toBe('Undefined everywhere')
      expect(await store.listNotifications(ids.bob)).toEqual([])
      expect(await store.countUnreadNotifications(ids.alice)).toBe(3)

      // Nobody else can mark mine.
      expect(await store.markNotificationsRead(ids.bob, liked.id)).toBe(0)
      expect(await store.markNotificationsRead(ids.alice, liked.id)).toBe(1)
      expect(await store.countUnreadNotifications(ids.alice)).toBe(2)
      expect(await store.markNotificationsRead(ids.alice)).toBe(2)
      expect(await store.countUnreadNotifications(ids.alice)).toBe(0)
    })

    it('removes comments, reactions and notifications with their article', async () => {
      const created = await store.createArticle(ids.alice, article())
      const comment = await store.createComment(ids.bob, created.id, 'Hi')
      await store.setReaction(created.id, ids.bob, { liked: true })
      await store.addNotification({ userId: ids.alice, actorId: ids.bob, articleId: created.id, type: 'comment' })
      await store.deleteArticle(ids.alice, created.id)
      expect(await store.getComment(comment.id)).toBeNull()
      expect(await store.listComments(created.id)).toEqual([])
      expect(await store.getReaction(created.id, ids.bob)).toEqual({ liked: false, rating: null })
      expect(await store.listNotifications(ids.alice)).toEqual([])
    })
  })
}

// A daily or global puzzle as the cron or the pool saves it.
export const puzzleFor = (day, overrides = {}) => ({
  kind: 'daily',
  day,
  difficulty: 'easy',
  language: 'python',
  concept: 'off-by-one',
  title: 'The missing last item',
  brokenCode: 'items = [1, 2, 3]\nfor i in range(len(items) - 1):\n    print(items[i])',
  symptom: 'Prints 1 and 2, but never 3.',
  hints: ['Count the lines printed.', 'Look at the range end.', 'range already stops before its end.'],
  ...overrides,
})

export const PUZZLE_SECRET = { solution: 'items = [1, 2, 3]\nfor i in range(len(items)):\n    print(items[i])', bugExplanation: 'range(len(items) - 1) skips the last index.' }

// YYYY-MM-DD in a far-off year, so tests against a shared database don't collide.
export function randomDay() {
  const pick = (count) => Math.floor(Math.random() * count)
  return `${2100 + pick(800)}-${String(1 + pick(12)).padStart(2, '0')}-${String(10 + pick(18))}`
}
