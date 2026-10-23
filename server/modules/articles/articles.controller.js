import { queryText } from '../../core/validation.js'
import * as articles from './articles.service.js'
import * as comments from './comments.service.js'
import * as notifications from './notifications.service.js'
import { react } from './reactions.service.js'

const SEARCH_KEYS = ['q', 'tag', 'author', 'sort', 'page']

export async function search(req, res) {
  const query = Object.fromEntries(SEARCH_KEYS.map((key) => [key, queryText(req, key)]))
  res.json(await articles.searchArticles(req.deps.store, query))
}

export async function get(req, res) {
  res.json(await articles.getArticle(req.deps.store, req.params.id, req.user))
}

export async function create(req, res) {
  res.status(201).json({ article: await articles.createArticle(req.deps.store, req.user, req.body) })
}

export async function update(req, res) {
  res.json({ article: await articles.updateArticle(req.deps.store, req.user, req.params.id, req.body) })
}

export async function remove(req, res) {
  await articles.deleteArticle(req.deps.store, req.user, req.params.id)
  res.json({ deleted: true })
}

export async function listComments(req, res) {
  res.json({ comments: await comments.listComments(req.deps.store, req.params.id) })
}

export async function addComment(req, res) {
  res.status(201).json({ comment: await comments.addComment(req.deps.store, req.user, req.params.id, req.body) })
}

export async function deleteComment(req, res) {
  await comments.deleteComment(req.deps.store, req.user, req.params.id)
  res.json({ deleted: true })
}

export async function reaction(req, res) {
  res.json(await react(req.deps.store, req.user, req.params.id, req.body))
}

export async function listNotifications(req, res) {
  res.json(await notifications.listNotifications(req.deps.store, req.user))
}

export async function markRead(req, res) {
  res.json(await notifications.markRead(req.deps.store, req.user, req.body))
}
