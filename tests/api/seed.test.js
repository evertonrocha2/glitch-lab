// @vitest-environment node
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
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
