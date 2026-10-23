// @vitest-environment node
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { parseProfile } from '../../server/modules/profile/profile.model.js'
import { seedDemo } from '../../server/modules/demo/demo.seed.js'
import { computeProgress } from '../../shared/progress.js'
import { trailView } from '../../shared/trails.js'
import { createLocalStore } from '../../server/infra/database/local/index.js'

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

it('gives the demo a study trail that the seeded work has already started', async () => {
  const store = await freshStore()
  await seedDemo(store, 'demo', '2026-10-22')

  const trails = await store.listTrails('demo')
  expect(trails).toHaveLength(1)
  const cases = await store.listCases('demo')
  const data = { cases, challenges: await store.listChallenges('demo'), notes: await store.listNotes('demo'), study: await store.listStudyTime('demo') }
  const view = trailView(trails[0], data)
  expect(view.total).toBeGreaterThanOrEqual(5)
  expect(new Set(view.missions.map((mission) => mission.kind)).size).toBe(5)
  for (const mission of view.missions.filter((item) => item.caseId)) expect(cases.some((item) => item.id === mission.caseId)).toBe(true)
  // Some missions done, one up next, and the trail not finished yet.
  expect(view.doneCount).toBeGreaterThanOrEqual(2)
  expect(view.complete).toBe(false)
  expect(view.missions.filter((mission) => mission.status === 'next')).toHaveLength(1)

  const progress = computeProgress({ ...data, today: '2026-10-22', trails })
  expect(progress.xp).toBe(computeProgress({ ...data, today: '2026-10-22' }).xp + view.xp)
})

it('gives the demo a profile that features badges it really earned', async () => {
  const store = await freshStore()
  const user = await store.createUser({ email: 'demo-x@demo.glitch', passwordHash: null, isDemo: true })
  await seedDemo(store, user.id, '2026-10-22')

  const profile = await store.getProfile(user.id)
  expect(profile).toMatchObject({ displayName: 'Demo Dev', isPublic: false })
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

it('fills in the demo about-you fields with values the API would accept', async () => {
  const store = await freshStore()
  const user = await store.createUser({ email: 'demo-y@demo.glitch', passwordHash: null, isDemo: true })
  await seedDemo(store, user.id, '2026-10-22')

  const profile = await store.getProfile(user.id)
  const about = { role: profile.role, headline: profile.headline, university: profile.university, course: profile.course, work: profile.work, location: profile.location, languages: profile.languages, links: profile.links, openTo: profile.openTo }
  expect(about.role).toEqual(expect.any(String))
  expect(about.headline.length).toBeGreaterThan(0)
  expect(about.languages.length).toBeGreaterThan(0)
  expect(about.openTo.length).toBeGreaterThan(0)
  // The same rules a real person's edits go through.
  expect(parseProfile(about)).toEqual({ value: about })
})

it('keeps the demo note and the demo profile private (demos can never share)', async () => {
  const store = await freshStore()
  const user = await store.createUser({ email: 'demo-z@demo.glitch', passwordHash: null, isDemo: true })
  await seedDemo(store, user.id, '2026-10-22')
  const [note] = await store.listNotes(user.id)
  expect(note.isPublic).toBe(false)
  expect((await store.getProfile(user.id)).isPublic).toBe(false)
})

it('seeds the sample texts in Portuguese for a pt-BR visitor, with errors and code left as printed', async () => {
  const store = await freshStore()
  const user = await store.createUser({ email: 'demo-pt@demo.glitch', passwordHash: null, isDemo: true })
  await seedDemo(store, user.id, '2026-10-22', 'pt-BR')
  const english = await freshStore()
  await seedDemo(english, 'demo', '2026-10-22')

  const cases = await store.listCases(user.id)
  const undefinedCase = cases.find((item) => item.concept === 'undefined-access')
  expect(undefinedCase.analysis.explicacao).toMatch(/^Seu código pediu o tamanho de user.name/)
  expect(undefinedCase.error).toBe("TypeError: Cannot read properties of undefined (reading 'length')")
  expect(cases.map((item) => item.code).sort()).toEqual((await english.listCases('demo')).map((item) => item.code).sort())

  const training = cases.find((item) => item.status === 'training')
  const open = await store.findOpenChallenge(user.id, training.id)
  expect(open.hints[0]).toBe('Olhe os números que o range() entrega para o loop.')
  expect(open.symptom).toBe('IndexError: list index out of range')

  const [note] = await store.listNotes(user.id)
  expect(note.title).toBe('Meu caderno de debugging')
  const [trail] = await store.listTrails(user.id)
  expect(trail.title).toBe('Bootcamp de índice e undefined')
  expect(trail.missions.map((mission) => mission.kind)).toEqual((await english.listTrails('demo'))[0].missions.map((mission) => mission.kind))
  expect(trail.missions[0].title).toBe('Vença um desafio de índice de lista')

  const profile = await store.getProfile(user.id)
  expect(profile).toMatchObject({ displayName: 'Dev Demo', headline: 'Estudando JavaScript e Python à noite', isPublic: false })
  const about = { headline: profile.headline, course: profile.course, work: profile.work, bio: profile.bio, displayName: profile.displayName }
  expect(parseProfile(about)).toEqual({ value: about })
})

it('keeps the English sample texts for anyone else', async () => {
  const store = await freshStore()
  await seedDemo(store, 'demo', '2026-10-22', 'en')
  const [note] = await store.listNotes('demo')
  expect(note.title).toBe('My debugging notebook')
  expect((await store.listTrails('demo'))[0].title).toBe('Index and undefined bootcamp')
})
