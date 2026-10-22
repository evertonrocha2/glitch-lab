// @vitest-environment node
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { seedDemo } from '../../api/_lib/seed.js'
import { createLocalStore } from '../../api/_lib/store/local.js'

const freshStore = async () => createLocalStore({ file: join(await mkdtemp(join(tmpdir(), 'gd-community-seed-')), 'db.json') })
const demoUser = (store) => store.createUser({ email: `demo-${crypto.randomUUID()}@demo.glitch`, passwordHash: null, isDemo: true })

it('fills the articles area with sample articles by a public sample author', async () => {
  const store = await freshStore()
  const demo = await demoUser(store)
  await seedDemo(store, demo.id, '2026-10-22')

  const author = await store.findPublicProfile('glitch_team')
  expect(author.profile).toMatchObject({ displayName: 'Glitch Team', isPublic: true })
  const { articles } = await store.searchArticles({ authorHandle: 'glitch_team', sort: 'new', offset: 0, limit: 10 })
  expect(articles.length).toBeGreaterThanOrEqual(2)
  expect(articles.length).toBeLessThanOrEqual(3)
  expect(articles.some((item) => item.commentCount > 0)).toBe(true)
  expect(articles.some((item) => item.likeCount > 0 && item.validCount > 0)).toBe(true)
  // No em dashes in the sample copy (U+2014).
  for (const item of articles) expect(item.body).not.toMatch(new RegExp(String.fromCharCode(0x2014)))
})

it('gives each demo one notification to open, and never seeds the samples twice', async () => {
  const store = await freshStore()
  const first = await demoUser(store)
  const second = await demoUser(store)
  await seedDemo(store, first.id, '2026-10-22')
  await seedDemo(store, second.id, '2026-10-22')

  const all = await store.searchArticles({ sort: 'new', offset: 0, limit: 10 })
  expect(all.articles.length).toBeLessThanOrEqual(3)
  for (const user of [first, second]) {
    const [note, ...rest] = await store.listNotifications(user.id)
    expect(rest).toEqual([])
    expect(note).toMatchObject({ type: 'comment', read: false })
    expect(all.articles.map((item) => item.id)).toContain(note.articleId)
  }
  // The demo's own notification comes from a sample reader, never from itself.
  const [note] = await store.listNotifications(first.id)
  expect(note.actorId).not.toBe(first.id)
})
