import { queryText } from '../../core/validation.js'
import * as communities from './communities.service.js'

// The answers change with who's asking (joined, owner, can post): never cached.
const fresh = (res) => res.set('Cache-Control', 'private, no-store')

export async function list(req, res) {
  const query = { q: queryText(req, 'q'), topic: queryText(req, 'topic'), page: queryText(req, 'page') }
  fresh(res).json(await communities.listCommunities(req.deps.store, req.user, query))
}

export async function create(req, res) {
  res.status(201).json({ community: await communities.createCommunity(req.deps.store, req.user, req.body) })
}

export async function get(req, res) {
  fresh(res).json(await communities.getCommunity(req.deps.store, req.params.slug, req.user))
}

export async function join(req, res) {
  res.json(await communities.join(req.deps.store, req.user, req.params.slug))
}

export async function leave(req, res) {
  res.json(await communities.leave(req.deps.store, req.user, req.params.slug))
}

export async function messages(req, res) {
  fresh(res).json(await communities.listMessages(req.deps.store, req.user, req.params.slug, req.query))
}

export async function post(req, res) {
  res.status(201).json({ message: await communities.postMessage(req.deps.store, req.user, req.params.slug, req.body) })
}

export async function deleteMessage(req, res) {
  await communities.deleteMessage(req.deps.store, req.user, req.params.id)
  res.json({ deleted: true })
}

export async function removeMember(req, res) {
  await communities.removeMember(req.deps.store, req.user, req.params.slug, req.params.userId)
  res.json({ removed: true })
}
