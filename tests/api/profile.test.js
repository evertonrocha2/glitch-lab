// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GET, PUT } from '../../api/profile.js'
import { createToken } from '../../api/_lib/auth/session.js'
import { apiRequest, useTempStore } from './helpers.js'
import { ABOUT, CASE, challengeFor, EMPTY_ABOUT, SECRET } from './store-contract.js'

let store
let ada
let bob

beforeEach(async () => {
  store = await useTempStore()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T15:00:00Z'))
  ada = await store.createUser({ email: 'ada@example.com', passwordHash: null, isDemo: false })
  bob = await store.createUser({ email: 'bob@example.com', passwordHash: null, isDemo: false })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

// Signed in as ada unless told otherwise. The session email is "<id>@test.dev".
const getMine = (token = `dev:${ada.id}`) => GET(apiRequest('/api/profile', { method: 'GET', token }))
const save = (body, token = `dev:${ada.id}`) => PUT(apiRequest('/api/profile', { method: 'PUT', body, token }))
const getPublic = (handle, token = null) => GET(apiRequest(`/api/profile?handle=${encodeURIComponent(handle)}&today=2026-10-22`, { method: 'GET', token }))

const VALID = {
  handle: 'ada_dev',
  displayName: 'Ada',
  bio: 'I read stack traces for fun.',
  avatar: { seed: 'abc123', color: 'cobalt' },
  featuredBadges: ['first-clue'],
  isPublic: true,
}

// One case, one passed challenge (no hints), a note and two study days.
async function giveAdaSomeWork() {
  const kase = await store.createCase(ada.id, CASE)
  await store.updateCase(ada.id, kase.id, { status: 'solved' })
  const challenge = await store.createChallenge(ada.id, challengeFor(kase.id), SECRET)
  await store.updateChallenge(ada.id, challenge.id, { status: 'passed' })
  await store.createNote(ada.id, { title: 'Secret diary', blocks: [{ id: 'b1', type: 'text', text: 'private thoughts' }] })
  await store.addStudyTime(ada.id, '2026-10-21', 600, 57_600)
  await store.addStudyTime(ada.id, '2026-10-22', 300, 57_600)
  return kase
}

it('asks for sign in to see or change your own profile', async () => {
  expect((await getMine(null)).status).toBe(401)
  expect((await save(VALID, null)).status).toBe(401)
})

it('fills in defaults before anything is chosen', async () => {
  const res = await getMine()
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body.profile).toEqual({
    handle: null,
    displayName: null,
    suggestedName: ada.id,
    bio: '',
    avatar: { seed: expect.stringMatching(/^[0-9a-f]{12}$/), color: 'violet' },
    featuredBadges: [],
    isPublic: false,
    ...EMPTY_ABOUT,
  })
  // Stable, but not the id itself, so it can be shown in public.
  expect((await (await getMine()).json()).profile.avatar).toEqual(body.profile.avatar)
  expect(body.profile.avatar.seed).not.toBe(ada.id)
  expect(body.earnedBadges).toEqual([])
  expect(JSON.stringify(body)).not.toContain('@')
})

it('lists the badges you have earned so you can feature them', async () => {
  await giveAdaSomeWork()
  const { earnedBadges, progress } = await (await getMine()).json()
  expect(earnedBadges).toEqual(expect.arrayContaining(['first-clue', 'fixed-it', 'case-closed', 'sharp-eye']))
  // 10 (case) + 30 (pass) + 15 (no hints) + 50 (solved) + 5 (note) + 15 (minutes)
  expect(progress).toEqual({ level: 2, title: 'Junior Detective', xp: 125, levelXp: 100, nextLevelXp: 300 })
})

it('saves a profile and normalizes the handle', async () => {
  const res = await save({ ...VALID, handle: '  Ada_Dev ' })
  expect(res.status).toBe(200)
  const { profile } = await res.json()
  expect(profile).toEqual({ ...VALID, ...EMPTY_ABOUT, suggestedName: ada.id })
  expect((await (await getMine()).json()).profile).toEqual({ ...VALID, ...EMPTY_ABOUT, suggestedName: ada.id })
})

it('changes only the fields sent', async () => {
  await save(VALID)
  await save({ bio: 'New bio.' })
  expect((await (await getMine()).json()).profile).toEqual({ ...VALID, ...EMPTY_ABOUT, bio: 'New bio.', suggestedName: ada.id })
})

it('saves the about-you fields, trimmed and tidied', async () => {
  const res = await save({
    ...ABOUT,
    headline: '  Learning React at night  ',
    languages: ['javascript', 'python', 'javascript'],
    links: { github: ' https://github.com/ada ', linkedin: '', website: 'https://ada.dev/' },
    openTo: ['internships', 'study-buddies', 'internships'],
  })
  expect(res.status).toBe(200)
  const { profile } = await res.json()
  expect(profile).toMatchObject({
    ...ABOUT,
    links: { github: 'https://github.com/ada', website: 'https://ada.dev/' },
    openTo: ['internships', 'study-buddies'],
  })
  expect((await (await getMine()).json()).profile).toEqual(profile)

  // Blank text and null role clear things again.
  const cleared = await (await save({ role: null, university: '  ', links: {} })).json()
  expect(cleared.profile).toMatchObject({ role: null, university: '', links: {}, headline: ABOUT.headline })
})

it('rejects about-you fields that do not fit the rules', async () => {
  const bad = [
    [{ role: 'ceo' }, 400],
    [{ role: 3 }, 400],
    [{ headline: 'x'.repeat(81) }, 413],
    [{ headline: 'two\nlines' }, 400],
    [{ university: 'x'.repeat(81) }, 413],
    [{ course: ['Math'] }, 400],
    [{ work: 'x'.repeat(81) }, 413],
    [{ location: 'x'.repeat(61) }, 413],
    [{ languages: ['javascript', 'cobol'] }, 400],
    [{ languages: 'python' }, 400],
    [{ languages: ['javascript', 'typescript', 'python', 'java', 'csharp', 'php', 'go', 'ruby', 'rust'] }, 400],
    [{ links: { github: 'https://gitlab.com/ada' } }, 400],
    [{ links: { linkedin: 'https://github.com/ada' } }, 400],
    [{ links: { website: 'http://ada.dev' } }, 400],
    [{ links: { website: 'javascript:alert(1)' } }, 400],
    [{ links: { myspace: 'https://myspace.com/ada' } }, 400],
    [{ links: { github: 42 } }, 400],
    [{ links: ['https://github.com/ada'] }, 400],
    [{ openTo: ['parties'] }, 400],
    [{ openTo: 'jobs' }, 400],
  ]
  for (const [body, status] of bad) {
    const res = await save(body)
    expect(res.status, JSON.stringify(body)).toBe(status)
    expect((await res.json()).message).toEqual(expect.any(String))
  }
  expect(await store.getProfile(ada.id)).toMatchObject(EMPTY_ABOUT)
})

it('says which link is wrong', async () => {
  const res = await save({ links: { github: 'https://gitlab.com/ada' } })
  expect((await res.json()).message).toMatch(/GitHub.*github\.com/)
})

it('goes back to the default name when the name is cleared', async () => {
  await save({ displayName: 'Ada' })
  const { profile } = await (await save({ displayName: '   ' })).json()
  expect(profile.displayName).toBeNull()
})

it('never stores the email-based name unless it is typed in', async () => {
  await save({ handle: 'ada_x', isPublic: true })
  expect((await store.getProfile(ada.id)).displayName).toBeNull()
  const res = await GET(apiRequest('/api/profile?handle=ada_x', { method: 'GET', token: null }))
  expect((await res.json()).profile.displayName).toBe('ada_x')
  expect(res.headers.get('Cache-Control')).toContain('s-maxage=60')
})

it('keeps demo accounts from claiming handles or going public', async () => {
  const demo = await store.createUser({ email: 'demo-1@demo.glitch', passwordHash: null, isDemo: true })
  const token = createToken({ id: demo.id, email: demo.email, isDemo: true })
  expect((await save({ handle: 'admin' }, token)).status).toBe(403)
  expect((await save({ isPublic: true }, token)).status).toBe(403)
  expect((await save({ bio: 'Just looking around.' }, token)).status).toBe(200)
})

it('rejects anything that does not fit the rules', async () => {
  const bad = [
    [{ handle: 'ab' }, 400],
    [{ handle: 'no spaces' }, 400],
    [{ handle: 42 }, 400],
    [{ displayName: 'x'.repeat(41) }, 413],
    [{ displayName: ['Ada'] }, 400],
    [{ bio: 'x'.repeat(161) }, 413],
    [{ avatar: { seed: 'x', color: 'neon-green' } }, 400],
    [{ avatar: { seed: '', color: 'violet' } }, 400],
    [{ avatar: { seed: 'x'.repeat(41), color: 'violet' } }, 400],
    [{ avatar: 'violet' }, 400],
    [{ featuredBadges: ['first-clue', 'fixed-it', 'case-closed', 'sharp-eye'] }, 400],
    [{ featuredBadges: ['made-up-badge'] }, 400],
    [{ featuredBadges: 'first-clue' }, 400],
    [{ isPublic: 'yes' }, 400],
  ]
  for (const [body, status] of bad) {
    const res = await save(body)
    expect(res.status, JSON.stringify(body)).toBe(status)
    expect((await res.json()).message).toEqual(expect.any(String))
  }
  expect((await save('not json')).status).toBe(400)
  expect((await (await getMine()).json()).profile.handle).toBeNull()
})

it('needs a handle before the profile can go public', async () => {
  const res = await save({ isPublic: true })
  expect(res.status).toBe(400)
  expect((await res.json()).message).toMatch(/handle/i)
  expect((await save({ handle: 'ada_dev' })).status).toBe(200)
  expect((await save({ isPublic: true })).status).toBe(200)
  expect((await save({ handle: null })).status).toBe(400)
})

it('drops repeated featured badges', async () => {
  const { profile } = await (await save({ featuredBadges: ['first-clue', 'first-clue'] })).json()
  expect(profile.featuredBadges).toEqual(['first-clue'])
})

it('refuses a handle another account has, in any case', async () => {
  await save(VALID, `dev:${bob.id}`)
  const res = await save({ ...VALID, handle: 'ADA_DEV' })
  expect(res.status).toBe(409)
  expect((await res.json()).message).toMatch(/taken/)
})

it('only changes your own profile', async () => {
  await save(VALID, `dev:${bob.id}`)
  await save({ ...VALID, handle: 'ada_real', displayName: 'Ada' })
  const bobs = await store.getProfile(bob.id)
  expect(bobs).toMatchObject({ handle: 'ada_dev', displayName: 'Ada' })
  expect((await store.getProfile(ada.id)).handle).toBe('ada_real')
})

it('says the account is gone when saving for a user that no longer exists', async () => {
  expect((await save({ bio: 'hi' }, 'dev:ghost')).status).toBe(404)
})

it('shows a public profile to anyone, without private details', async () => {
  const kase = await giveAdaSomeWork()
  await save({ ...VALID, featuredBadges: ['case-closed', 'marathon'] })

  const res = await getPublic('ADA_DEV')
  expect(res.status).toBe(200)
  const { profile } = await res.json()
  expect(profile).toMatchObject({
    handle: 'ada_dev',
    displayName: 'Ada',
    bio: VALID.bio,
    avatar: VALID.avatar,
    level: 2,
    title: 'Junior Detective',
    xp: 125,
    levelXp: 100,
    nextLevelXp: 300,
    streak: 2,
    totalSeconds: 900,
    counts: { cases: 1, solved: 1, passedChallenges: 1 },
    memberSince: ada.createdAt,
  })
  expect(profile.badges).toEqual(expect.arrayContaining(['first-clue', 'case-closed']))
  // Marathon isn't earned yet, so it isn't shown even though it was picked.
  expect(profile.featuredBadges).toEqual(['case-closed'])

  const text = JSON.stringify(profile)
  for (const secret of ['ada@example.com', '@test.dev', ada.id, kase.id, CASE.error, 'Secret diary', 'private thoughts', 'isPublic']) {
    expect(text).not.toContain(secret)
  }
})

it('uses the handle as the name in public when no name was picked', async () => {
  await save({ handle: 'ada_dev', isPublic: true })
  const { profile } = await (await getPublic('ada_dev')).json()
  expect(profile.displayName).toBe('ada_dev')
  expect(profile.avatar).toEqual((await (await getMine()).json()).profile.avatar)
  expect(JSON.stringify(profile)).not.toContain(ada.id)
})

it('answers 404 for a private, missing or malformed handle', async () => {
  await save({ ...VALID, isPublic: false })
  for (const handle of ['ada_dev', 'nobody', '../etc', '']) {
    const res = await getPublic(handle)
    expect(res.status, handle).toBe(404)
  }
})

it('shows the about-you fields on the public profile', async () => {
  await save({ ...VALID, ...ABOUT })
  const { profile } = await (await getPublic('ada_dev')).json()
  expect(profile).toMatchObject(ABOUT)
})

const search = (query) => GET(apiRequest(`/api/profile?search=${encodeURIComponent(query)}`, { method: 'GET', token: null }))

it('finds public detectives by handle or name, signed out', async () => {
  await save({ ...VALID, ...ABOUT })
  await save({ handle: 'bob_hidden', displayName: 'Ada Twin', isPublic: false }, `dev:${bob.id}`)

  const res = await search('ADA')
  expect(res.status).toBe(200)
  const { profiles } = await res.json()
  expect(profiles).toEqual([
    {
      handle: 'ada_dev',
      displayName: 'Ada',
      avatar: VALID.avatar,
      role: ABOUT.role,
      headline: ABOUT.headline,
      university: ABOUT.university,
      work: ABOUT.work,
      location: ABOUT.location,
      languages: ABOUT.languages,
    },
  ])
  const text = JSON.stringify(profiles)
  for (const secret of [ada.id, 'ada@example.com', 'bob_hidden', 'Ada Twin']) expect(text).not.toContain(secret)

  // An empty search lists the newest public profiles.
  expect((await (await search('')).json()).profiles.map((item) => item.handle)).toEqual(['ada_dev'])
  expect((await (await search('nobody-like-this')).json()).profiles).toEqual([])
})

it('caps a search at 20 profiles', async () => {
  for (let index = 0; index < 22; index++) {
    const user = await store.createUser({ email: `p${index}@example.com`, passwordHash: null, isDemo: false })
    await store.updateProfile(user.id, { handle: `detective_${index}`, isPublic: true })
  }
  expect((await (await search('detective')).json()).profiles).toHaveLength(20)
})

it('refuses a search that is too long or has odd characters', async () => {
  expect((await search('x'.repeat(41))).status).toBe(400)
  expect((await search('ada%')).status).toBe(400)
  expect((await search('a,b(')).status).toBe(400)
  expect((await search('  Ada Lovelace_1-x.y ')).status).toBe(200)
})

it('finds a handle typed with its @', async () => {
  await save({ handle: 'ada_at', isPublic: true })
  const res = await GET(apiRequest('/api/profile?search=%40ada_at', { method: 'GET', token: null }))
  expect(res.status).toBe(200)
  expect((await res.json()).profiles.map((item) => item.handle)).toEqual(['ada_at'])
})
