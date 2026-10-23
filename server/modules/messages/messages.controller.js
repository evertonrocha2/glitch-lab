import * as conversations from './conversations.service.js'
import * as safety from './safety.service.js'

// Private, per-person answers: never kept by a CDN or the browser cache.
const fresh = (res) => res.set('Cache-Control', 'private, no-store')

export async function list(req, res) {
  fresh(res).json(await conversations.listConversations(req.deps.store, req.user))
}

export async function unread(req, res) {
  fresh(res).json(await conversations.unreadCount(req.deps.store, req.user))
}

export async function start(req, res) {
  res.status(201).json({ conversation: await conversations.startConversation(req.deps.store, req.user, req.body) })
}

export async function messages(req, res) {
  fresh(res).json(await conversations.listMessages(req.deps.store, req.user, req.params.id, req.query))
}

export async function send(req, res) {
  res.status(201).json({ message: await conversations.sendMessage(req.deps.store, req.user, req.params.id, req.body) })
}

export async function read(req, res) {
  res.json(await conversations.markRead(req.deps.store, req.user, req.params.id))
}

export async function withPerson(req, res) {
  fresh(res).json(await conversations.messagingWith(req.deps.store, req.user, req.params.handle))
}

export async function getSettings(req, res) {
  fresh(res).json(await safety.getSettings(req.deps.store, req.user))
}

export async function saveSettings(req, res) {
  res.json(await safety.saveSettings(req.deps.store, req.user, req.body))
}

export async function block(req, res) {
  res.json(await safety.block(req.deps.store, req.user, req.body))
}

export async function unblock(req, res) {
  res.json(await safety.unblock(req.deps.store, req.user, req.body))
}

export async function report(req, res) {
  res.status(201).json(await safety.report(req.deps.store, req.user, req.body))
}
