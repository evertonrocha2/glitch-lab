// @vitest-environment node
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { computeProgress } from '../../shared/progress.js'
import { seedDemo } from '../../api/_lib/seed.js'
import { createLocalStore } from '../../api/_lib/store/local.js'

const freshStore = async () => createLocalStore({ file: join(await mkdtemp(join(tmpdir(), 'gd-seed-')), 'db.json') })

it('seeds the demo board across all three columns', async () => {
  const store = await freshStore()
  expect(await seedDemo(store, 'demo')).toBe(true)

  const cases = await store.listCases('demo')
  expect(cases.map((item) => item.status).sort()).toEqual(['new', 'new', 'solved', 'training'])

  const training = cases.find((item) => item.status === 'training')
  expect(training.passedCount).toBe(1)
  const challenge = await store.findOpenChallenge('demo', training.id)
  expect(challenge.hints).toHaveLength(3)
  expect(await store.getChallengeSecret(challenge.id)).toMatchObject({ solution: expect.any(String) })
  expect((await store.listCases('demo')).find((item) => item.status === 'solved').passedCount).toBe(2)
})

it('leaves a board that already has cases alone', async () => {
  const store = await freshStore()
  await seedDemo(store, 'demo')
  expect(await seedDemo(store, 'demo')).toBe(false)
  expect(await store.listCases('demo')).toHaveLength(4)
})

it('gives the demo a gym history, a note and a study streak', async () => {
  const store = await freshStore()
  await seedDemo(store, 'demo', '2026-10-22')

  const challenges = await store.listChallenges('demo')
  expect(challenges.filter((item) => item.status === 'passed')).toHaveLength(3)
  const [note] = await store.listNotes('demo')
  const cases = await store.listCases('demo')
  const mentioned = note.blocks.filter((block) => block.type === 'case').map((block) => block.caseId)
  expect(mentioned.length).toBeGreaterThan(0)
  for (const id of mentioned) expect(cases.some((item) => item.id === id)).toBe(true)

  const progress = computeProgress({ cases, challenges, notes: [note], study: await store.listStudyTime('demo'), today: '2026-10-22' })
  expect(progress.streak).toBe(3)
  expect(progress.badges.filter((badge) => badge.earned).length).toBeGreaterThanOrEqual(5)
  expect(progress.badges.some((badge) => !badge.earned)).toBe(true)
})

it('gives the demo a profile that features badges it really earned', async () => {
  const store = await freshStore()
  const user = await store.createUser({ email: 'demo-x@demo.glitch', passwordHash: null, isDemo: true })
  await seedDemo(store, user.id, '2026-10-22')

  const profile = await store.getProfile(user.id)
  expect(profile).toMatchObject({ displayName: 'Demo Detective', isPublic: false })
  expect(profile.bio.length).toBeGreaterThan(0)
  expect(profile.featuredBadges.length).toBeGreaterThanOrEqual(2)
  expect(profile.featuredBadges.length).toBeLessThanOrEqual(3)

  const progress = computeProgress({
    cases: await store.listCases(user.id),
    challenges: await store.listChallenges(user.id),
    notes: await store.listNotes(user.id),
    study: await store.listStudyTime(user.id),
    today: '2026-10-22',
  })
  const earned = progress.badges.filter((badge) => badge.earned).map((badge) => badge.id)
  for (const id of profile.featuredBadges) expect(earned).toContain(id)
})
