// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  addArticleComment,
  createArticle,
  deleteArticle,
  deleteArticleComment,
  getArticle,
  listArticles,
  listNotifications,
  markNotificationsRead,
  reactToArticle,
  updateArticle,
} from './api.js'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json({ ok: true })))
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const lastCall = () => {
  const [url, init] = fetch.mock.lastCall
  return { url, method: init.method, auth: init.headers.Authorization, body: init.body && JSON.parse(init.body) }
}

it('searches articles signed out, sending only the filters given', async () => {
  fetch.mockImplementation(async () => Response.json({ articles: [], page: 1, hasMore: false }))
  await expect(listArticles({ q: 'undefined everywhere', tag: '', sort: 'top', page: 2 })).resolves.toEqual({ articles: [], page: 1, hasMore: false })
  expect(lastCall()).toMatchObject({ url: '/api/community?resource=articles&q=undefined+everywhere&sort=top&page=2', method: 'GET', auth: undefined })
  await listArticles()
  expect(lastCall().url).toBe('/api/community?resource=articles')
  await listArticles({ author: 'ada_dev' }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/community?resource=articles&author=ada_dev', auth: 'Bearer t1' })
})

it('reads one article with its comments', async () => {
  await getArticle('a 1', 't1')
  expect(lastCall()).toMatchObject({ url: '/api/community?resource=articles&id=a%201', method: 'GET', auth: 'Bearer t1' })
})

it('writes, edits and deletes articles', async () => {
  fetch.mockResolvedValue(Response.json({ article: { id: 'a1' } }))
  await expect(createArticle({ title: 'T', body: 'B', tags: ['js'], caseId: null }, 't1')).resolves.toEqual({ id: 'a1' })
  expect(lastCall()).toMatchObject({ url: '/api/community?resource=articles', method: 'POST', body: { title: 'T', body: 'B', tags: ['js'], caseId: null } })
  fetch.mockResolvedValue(Response.json({ article: { id: 'a1' } }))
  await updateArticle('a1', { title: 'New' }, 't1')
  expect(lastCall()).toMatchObject({ method: 'PUT', body: { id: 'a1', title: 'New' } })
  fetch.mockResolvedValue(Response.json({ deleted: true }))
  await deleteArticle('a1', 't1')
  expect(lastCall()).toMatchObject({ url: '/api/community?resource=articles&id=a1', method: 'DELETE' })
})

it('comments and reacts', async () => {
  fetch.mockResolvedValue(Response.json({ comment: { id: 'c1' } }))
  await expect(addArticleComment('a1', 'Nice', 't1')).resolves.toEqual({ id: 'c1' })
  expect(lastCall()).toMatchObject({ url: '/api/community?resource=comments', method: 'POST', body: { articleId: 'a1', body: 'Nice' } })
  fetch.mockResolvedValue(Response.json({ deleted: true }))
  await deleteArticleComment('c1', 't1')
  expect(lastCall()).toMatchObject({ url: '/api/community?resource=comments&id=c1', method: 'DELETE' })
  fetch.mockResolvedValue(Response.json({ reaction: { liked: true, rating: null }, counts: {} }))
  await reactToArticle('a1', { like: true }, 't1')
  expect(lastCall()).toMatchObject({ url: '/api/community?resource=reactions', method: 'POST', body: { articleId: 'a1', like: true } })
})

it('loads notifications and marks them read', async () => {
  fetch.mockResolvedValue(Response.json({ notifications: [], unread: 0 }))
  await expect(listNotifications('t1')).resolves.toEqual({ notifications: [], unread: 0 })
  expect(lastCall()).toMatchObject({ url: '/api/community?resource=notifications', method: 'GET' })
  fetch.mockResolvedValue(Response.json({ unread: 2 }))
  await expect(markNotificationsRead('n1', 't1')).resolves.toBe(2)
  expect(lastCall().body).toEqual({ id: 'n1' })
  fetch.mockResolvedValue(Response.json({ unread: 0 }))
  await markNotificationsRead(null, 't1')
  expect(lastCall().body).toEqual({ all: true })
})

it('shows the server message on a refused write', async () => {
  fetch.mockResolvedValue(Response.json({ message: 'You can publish 5 articles a day. Come back tomorrow.' }, { status: 429 }))
  await expect(createArticle({ title: 'T', body: 'B', tags: [] }, 't1')).rejects.toThrow('You can publish 5 articles a day.')
})
