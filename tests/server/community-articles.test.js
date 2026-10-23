// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COMMUNITY_LIMITS } from '../../shared/community.js'
import { ARTICLE, call, makeUser } from './community-helpers.js'
import { useTempStore } from './helpers.js'
import { CASE } from './store-contract.js'

let store
let ada
let bob

beforeEach(async () => {
  store = await useTempStore()
  ada = await makeUser(store, 'ada', { profile: { handle: 'ada_dev', displayName: 'Ada', isPublic: true, avatar: { seed: 'abc', color: 'cobalt' } } })
  bob = await makeUser(store, 'bob', { profile: { handle: 'bobby' } })
})
afterEach(() => {
  vi.unstubAllEnvs()
})

const publish = (fields = {}, token = ada.token) => call('POST', '/api/articles', { body: { ...ARTICLE, ...fields }, token })
const read = (id, token = null) => call('GET', `/api/articles/${id}`, { token })
const list = (query = '', token = null) => call('GET', `/api/articles${query ? `?${query}` : ''}`, { token })

describe('publishing', () => {
  it('asks for sign in', async () => {
    expect((await publish({}, null)).status).toBe(401)
  })

  it('publishes an article with its author', async () => {
    const res = await publish()
    expect(res.status).toBe(201)
    expect(res.body.article).toMatchObject({
      title: ARTICLE.title,
      body: ARTICLE.body,
      tags: ARTICLE.tags,
      mine: true,
      author: { handle: 'ada_dev', name: 'Ada', avatar: { seed: 'abc', color: 'cobalt' }, isPublic: true },
      counts: { likes: 0, valid: 0, bad: 0, comments: 0 },
      linkedCase: null,
    })
    // Visitors never see who someone is by id.
    expect(res.body.article).not.toHaveProperty('authorId')
  })

  it('cleans up the title and tags', async () => {
    const res = await publish({ title: '  Spaces around  ', tags: ['JavaScript', '#Loops', 'javascript'] })
    expect(res.body.article).toMatchObject({ title: 'Spaces around', tags: ['javascript', 'loops'] })
  })

  it('refuses a missing or too long title or body', async () => {
    expect((await publish({ title: '   ' })).status).toBe(400)
    expect((await publish({ body: '' })).status).toBe(400)
    expect((await publish({ title: 42 })).status).toBe(400)
    expect((await publish({ title: 'x'.repeat(COMMUNITY_LIMITS.title + 1) })).status).toBe(413)
    expect((await publish({ body: 'x'.repeat(COMMUNITY_LIMITS.body + 1) })).status).toBe(413)
  })

  it('refuses bad tags', async () => {
    expect((await publish({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] })).status).toBe(400)
    expect((await publish({ tags: ['c++'] })).status).toBe(400)
    expect((await publish({ tags: 'javascript' })).status).toBe(400)
  })

  it('links only a case from your own board, and shows only its type, bug type and language', async () => {
    const mine = await store.createCase(ada.id, { ...CASE, code: 'const secretCode = 1' })
    const theirs = await store.createCase(bob.id, CASE)
    expect((await publish({ caseId: theirs.id })).status).toBe(400)

    const res = await publish({ caseId: mine.id })
    expect(res.status).toBe(201)
    const visitor = await read(res.body.article.id)
    expect(visitor.body.article.linkedCase).toEqual({ errorType: 'TypeError', concept: 'Reading undefined', language: 'javascript' })
    const text = JSON.stringify(visitor.body)
    expect(text).not.toContain('secretCode')
    expect(text).not.toContain(mine.id)
    // The author's editor gets the case id back.
    expect((await read(res.body.article.id, ada.token)).body.article.caseId).toBe(mine.id)
  })

  it('does not let demo accounts publish', async () => {
    const res = await publish({}, 'dev:demo')
    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/Sign up/)
  })

  it(`allows ${COMMUNITY_LIMITS.articlesPerDay} articles a day`, async () => {
    for (let index = 0; index < COMMUNITY_LIMITS.articlesPerDay; index++) expect((await publish()).status).toBe(201)
    const res = await publish()
    expect(res.status).toBe(429)
    expect(res.body.message).toMatch(/a day/)
    // Someone else still can.
    expect((await publish({}, bob.token)).status).toBe(201)
  })

  it('does not count a refused article toward the daily limit', async () => {
    for (let index = 0; index < 10; index++) await publish({ title: '' })
    expect((await publish()).status).toBe(201)
  })
})

describe('reading', () => {
  it('reads an article with its comments, signed out', async () => {
    const { article } = (await publish()).body
    await call('POST', `/api/articles/${article.id}/comments`, { body: { body: 'Nice one.' }, token: bob.token })
    const res = await read(article.id)
    expect(res.status).toBe(200)
    expect(res.body.article).toMatchObject({ id: article.id, body: ARTICLE.body, mine: false, counts: { comments: 1 } })
    expect(res.body.article).not.toHaveProperty('caseId')
    expect(res.body.comments).toEqual([
      expect.objectContaining({ body: 'Nice one.', author: expect.objectContaining({ handle: 'bobby', name: 'bobby', isPublic: false }), canDelete: false }),
    ])
    expect(res.body.reaction).toBeNull()
  })

  it("shows the reader's own reaction when signed in", async () => {
    const { article } = (await publish()).body
    await call('POST', `/api/articles/${article.id}/reactions`, { body: { like: true }, token: bob.token })
    expect((await read(article.id, bob.token)).body.reaction).toEqual({ liked: true, rating: null })
  })

  it('treats a broken token as signed out when reading', async () => {
    const { article } = (await publish()).body
    expect((await read(article.id, 'not-a-token')).status).toBe(200)
  })

  it('says when an article is missing', async () => {
    expect((await read('nope')).status).toBe(404)
  })

  it('names authors without a profile name after their handle, then "Player"', async () => {
    const plain = await makeUser(store, 'plain')
    const { article } = (await publish({}, plain.token)).body
    expect(article.author).toMatchObject({ name: 'Player', handle: null, isPublic: false })
    expect(article.author.avatar).toEqual({ seed: expect.any(String), color: expect.any(String) })
    expect(article.author.avatar.seed).not.toContain(plain.id)
    const byBob = (await publish({}, bob.token)).body.article
    expect(byBob.author).toMatchObject({ name: 'bobby', handle: 'bobby' })
  })
})

describe('editing and deleting', () => {
  it('lets the author edit and delete, nobody else', async () => {
    const { article } = (await publish()).body
    const edit = (body, token) => call('PATCH', `/api/articles/${article.id}`, { body, token })

    expect((await edit({ title: 'Mine now' }, bob.token)).status).toBe(404)
    expect((await edit({ title: 'x' }, null)).status).toBe(401)
    const res = await edit({ title: 'Reading undefined', tags: ['js'] }, ada.token)
    expect(res.status).toBe(200)
    expect(res.body.article).toMatchObject({ title: 'Reading undefined', body: ARTICLE.body, tags: ['js'] })
    expect((await edit({ title: '' }, ada.token)).status).toBe(400)
    // No body at all is a bad request; a path without an id is no route.
    expect((await call('PATCH', `/api/articles/${article.id}`, { token: ada.token })).status).toBe(400)
    expect((await call('PATCH', '/api/articles', { body: { title: 'no id' }, token: ada.token })).status).toBe(404)

    expect((await call('DELETE', `/api/articles/${article.id}`, { token: bob.token })).status).toBe(404)
    expect((await call('DELETE', `/api/articles/${article.id}`, { token: ada.token })).status).toBe(200)
    expect((await read(article.id)).status).toBe(404)
  })

  it("can't link someone else's case on edit", async () => {
    const { article } = (await publish()).body
    const theirs = await store.createCase(bob.id, CASE)
    const res = await call('PATCH', `/api/articles/${article.id}`, { body: { caseId: theirs.id }, token: ada.token })
    expect(res.status).toBe(400)
    const cleared = await call('PATCH', `/api/articles/${article.id}`, { body: { caseId: null }, token: ada.token })
    expect(cleared.body.article.linkedCase).toBeNull()
  })
})

describe('searching', () => {
  beforeEach(async () => {
    await publish({ title: 'Undefined everywhere', tags: ['javascript'] })
    await publish({ title: 'Off by one in loops', body: 'range() stops early.', tags: ['python', 'loops'] }, bob.token)
    await publish({ title: 'Async traps', body: 'Forgot to await a promise.', tags: ['javascript', 'async'] }, bob.token)
  })
  const titles = (res) => res.body.articles.map((item) => item.title)

  it('lists newest first with short excerpts, signed out', async () => {
    const res = await list()
    expect(res.status).toBe(200)
    expect(titles(res)).toEqual(['Async traps', 'Off by one in loops', 'Undefined everywhere'])
    expect(res.body).toMatchObject({ page: 1, hasMore: false })
    const [first] = res.body.articles
    expect(first).toMatchObject({ excerpt: 'Forgot to await a promise.', tags: ['javascript', 'async'], author: { name: 'bobby' } })
    expect(first).not.toHaveProperty('body')
  })

  it('finds by words, tag and author', async () => {
    expect(titles(await list('q=PROMISE'))).toEqual(['Async traps'])
    expect(titles(await list('q=loops'))).toEqual(['Off by one in loops'])
    expect(titles(await list('tag=javascript'))).toEqual(['Async traps', 'Undefined everywhere'])
    expect(titles(await list('q=ada'))).toEqual(['Undefined everywhere'])
    expect(titles(await list('author=BOBBY'))).toEqual(['Async traps', 'Off by one in loops'])
    expect(titles(await list('author=bobby&tag=python'))).toEqual(['Off by one in loops'])
    expect(titles(await list('author=nobody'))).toEqual([])
    expect(titles(await list('author=x'))).toEqual([])
  })

  it('treats filter syntax in a search as plain words', async () => {
    const res = await list(`q=${encodeURIComponent('title.ilike.*),body.ilike.(%')}`)
    expect(res.status).toBe(200)
    expect(titles(res)).toEqual([])
  })

  it('sorts by likes and by valid ratings', async () => {
    const all = (await list()).body.articles
    const id = (title) => all.find((item) => item.title === title).id
    await call('POST', `/api/articles/${id('Undefined everywhere')}/reactions`, { body: { like: true }, token: bob.token })
    await call('POST', `/api/articles/${id('Off by one in loops')}/reactions`, { body: { rating: 'valid' }, token: ada.token })
    expect(titles(await list('sort=top'))[0]).toBe('Undefined everywhere')
    expect(titles(await list('sort=valid'))[0]).toBe('Off by one in loops')
    // Anything else falls back to newest.
    expect(titles(await list('sort=drop'))[0]).toBe('Async traps')
  })

  it('pages through results', async () => {
    for (let index = 0; index < COMMUNITY_LIMITS.pageSize; index++) await store.createArticle(bob.id, { ...ARTICLE, title: `Filler ${index}`, caseId: null })
    const first = await list()
    expect(first.body.articles).toHaveLength(COMMUNITY_LIMITS.pageSize)
    expect(first.body.hasMore).toBe(true)
    const second = await list('page=2')
    expect(second.body).toMatchObject({ page: 2, hasMore: false })
    expect(titles(second)).toEqual(['Async traps', 'Off by one in loops', 'Undefined everywhere'])
    expect((await list('page=-3')).body.page).toBe(1)
  })
})

it('answers unknown paths and methods with 404', async () => {
  expect(await call('GET', '/api/secrets')).toMatchObject({ status: 404, body: { message: 'Not found.' } })
  expect((await call('PUT', '/api/comments/x', { token: ada.token, body: {} })).status).toBe(404)
})
