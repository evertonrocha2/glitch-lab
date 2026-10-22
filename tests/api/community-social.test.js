// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COMMUNITY_LIMITS } from '../../shared/community.js'
import { ARTICLE, call, makeUser } from './community-helpers.js'
import { useTempStore } from './helpers.js'

let store
let ada
let bob
let cy
let article

beforeEach(async () => {
  store = await useTempStore()
  ada = await makeUser(store, 'ada', { profile: { handle: 'ada_dev', displayName: 'Ada', isPublic: true } })
  bob = await makeUser(store, 'bob', { profile: { displayName: 'Bo' } })
  cy = await makeUser(store, 'cy')
  article = (await call('POST', 'articles', { body: ARTICLE, token: ada.token })).body.article
})
afterEach(() => {
  vi.unstubAllEnvs()
})

const comment = (body, token, articleId = article.id) => call('POST', 'comments', { body: { articleId, body }, token })
const react = (body, token) => call('POST', 'reactions', { body: { articleId: article.id, ...body }, token })
const notifications = (token) => call('GET', 'notifications', { token })

describe('comments', () => {
  it('posts a comment and lists it for anyone', async () => {
    const res = await comment('  Great tip.  ', bob.token)
    expect(res.status).toBe(201)
    expect(res.body.comment).toMatchObject({ body: 'Great tip.', author: { name: 'Bo' }, canDelete: true })
    const listed = await call('GET', 'comments', { query: `articleId=${article.id}` })
    expect(listed.body.comments.map((item) => item.body)).toEqual(['Great tip.'])
  })

  it('asks for sign in and refuses demo accounts', async () => {
    expect((await comment('hi', null)).status).toBe(401)
    const demo = await comment('hi', 'dev:demo')
    expect(demo.status).toBe(403)
    expect(demo.body.message).toMatch(/Sign up/)
  })

  it('refuses empty, too long or misplaced comments', async () => {
    expect((await comment('   ', bob.token)).status).toBe(400)
    expect((await comment('x'.repeat(COMMUNITY_LIMITS.comment + 1), bob.token)).status).toBe(413)
    expect((await comment('hi', bob.token, 'missing')).status).toBe(404)
    expect((await call('POST', 'comments', { body: { body: 'no article' }, token: bob.token })).status).toBe(400)
  })

  it('lets the comment author or the article author delete it, nobody else', async () => {
    const first = (await comment('one', bob.token)).body.comment
    const second = (await comment('two', bob.token)).body.comment
    const remove = (id, token) => call('DELETE', 'comments', { query: `id=${id}`, token })
    expect((await remove(first.id, cy.token)).status).toBe(403)
    expect((await remove(first.id, bob.token)).status).toBe(200)
    expect((await remove(second.id, ada.token)).status).toBe(200)
    expect((await remove(second.id, ada.token)).status).toBe(404)
    expect((await call('GET', 'articles', { query: `id=${article.id}` })).body.article.counts.comments).toBe(0)
  })

  it('marks which comments the reader can delete', async () => {
    await comment('from bo', bob.token)
    const asCy = await call('GET', 'articles', { query: `id=${article.id}`, token: cy.token })
    expect(asCy.body.comments[0].canDelete).toBe(false)
    const asAuthor = await call('GET', 'articles', { query: `id=${article.id}`, token: ada.token })
    expect(asAuthor.body.comments[0].canDelete).toBe(true)
  })

  it(`allows ${COMMUNITY_LIMITS.commentsPerDay} comments a day`, async () => {
    for (let index = 0; index < COMMUNITY_LIMITS.commentsPerDay; index++) await comment(`c${index}`, bob.token)
    expect((await comment('one more', bob.token)).status).toBe(429)
  })
})

describe('reactions', () => {
  it('toggles a like and changes or removes a rating, with counts', async () => {
    let res = await react({ like: true }, bob.token)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ reaction: { liked: true, rating: null }, counts: { likes: 1, valid: 0, bad: 0, comments: 0 } })
    res = await react({ rating: 'valid' }, bob.token)
    expect(res.body.reaction).toEqual({ liked: true, rating: 'valid' })
    res = await react({ rating: 'bad' }, bob.token)
    expect(res.body.counts).toMatchObject({ valid: 0, bad: 1 })
    res = await react({ like: false, rating: null }, bob.token)
    expect(res.body).toEqual({ reaction: { liked: false, rating: null }, counts: { likes: 0, valid: 0, bad: 0, comments: 0 } })
  })

  it('refuses bad input, missing articles and signed-out readers', async () => {
    expect((await react({ like: 'yes' }, bob.token)).status).toBe(400)
    expect((await react({ rating: 'great' }, bob.token)).status).toBe(400)
    expect((await react({}, bob.token)).status).toBe(400)
    expect((await call('POST', 'reactions', { body: { articleId: 'missing', like: true }, token: bob.token })).status).toBe(404)
    expect((await react({ like: true }, null)).status).toBe(401)
  })

  it("doesn't let authors like or rate their own article", async () => {
    const rated = await react({ rating: 'valid' }, ada.token)
    expect(rated.status).toBe(403)
    expect(rated.body.message).toMatch(/your own/)
    expect((await react({ like: true }, ada.token)).status).toBe(403)
  })

  it('lets demo accounts react, but their reactions earn the author no XP', async () => {
    expect((await react({ like: true, rating: 'valid' }, 'dev:demo')).status).toBe(200)
    expect(await store.communityStats(ada.id)).toMatchObject({ likesReceived: 0, validReceived: 0 })
    await react({ like: true, rating: 'valid' }, bob.token)
    expect(await store.communityStats(ada.id)).toMatchObject({ likesReceived: 1, validReceived: 1 })
  })
})

describe('notifications', () => {
  it('tells the author about comments, likes and ratings from others', async () => {
    await comment('Great tip.', bob.token)
    await react({ like: true }, bob.token)
    await react({ rating: 'valid' }, cy.token)
    const res = await notifications(ada.token)
    expect(res.status).toBe(200)
    expect(res.body.unread).toBe(3)
    expect(res.body.notifications.map((item) => [item.type, item.actor.name])).toEqual([
      ['rating_valid', 'Detective'],
      ['like', 'Bo'],
      ['comment', 'Bo'],
    ])
    expect(res.body.notifications[0]).toMatchObject({ articleId: article.id, articleTitle: ARTICLE.title, read: false })
    expect(res.body.notifications[0]).not.toHaveProperty('actorId')
    expect(res.body.notifications[0]).not.toHaveProperty('userId')
  })

  it('stays quiet about your own actions', async () => {
    await comment('Edit: typo fixed.', ada.token)
    expect((await notifications(ada.token)).body).toEqual({ notifications: [], unread: 0 })
  })

  it("doesn't spam when someone toggles a like or changes a rating", async () => {
    await react({ like: true }, bob.token)
    await react({ like: false }, bob.token)
    await react({ like: true }, bob.token)
    await react({ rating: 'valid' }, bob.token)
    await react({ rating: 'valid' }, bob.token)
    await react({ rating: null }, bob.token)
    await react({ rating: 'valid' }, bob.token)
    await react({ rating: 'bad' }, bob.token)
    await react({ rating: 'valid' }, bob.token)
    const types = (await notifications(ada.token)).body.notifications.map((item) => item.type)
    expect(types).toEqual(['rating_bad', 'rating_valid', 'like'])
  })

  it('keeps each person to their own notifications', async () => {
    await comment('hi', bob.token)
    expect((await notifications(bob.token)).body.notifications).toEqual([])
    expect((await notifications(null)).status).toBe(401)
  })

  it('marks one or all as read', async () => {
    await comment('one', bob.token)
    await comment('two', cy.token)
    const [latest] = (await notifications(ada.token)).body.notifications
    const mark = (body, token = ada.token) => call('POST', 'notifications', { body, token })

    // Someone else's id changes nothing.
    expect((await mark({ id: latest.id }, bob.token)).body.unread).toBe(0)
    expect((await notifications(ada.token)).body.unread).toBe(2)

    expect((await mark({ id: latest.id })).body).toEqual({ unread: 1 })
    expect((await mark({ all: true })).body).toEqual({ unread: 0 })
    expect((await mark({})).status).toBe(400)
    expect((await mark({ id: 42 })).status).toBe(400)
  })
})
