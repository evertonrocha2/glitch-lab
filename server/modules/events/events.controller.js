import { queryText } from '../../core/validation.js'
import { submitEntry, updateEntry } from './entries.service.js'
import * as events from './events.service.js'
import { voteEntry } from './votes.service.js'

export async function list(req, res) {
  const query = { q: queryText(req, 'q'), tab: queryText(req, 'tab'), page: queryText(req, 'page') }
  res.json(await events.listEvents(req.deps.store, query))
}

export async function get(req, res) {
  res.json(await events.getEvent(req.deps.store, req.params.id, req.user))
}

export async function create(req, res) {
  res.status(201).json(await events.createEvent(req.deps.store, req.user, req.body))
}

// edit, close and winners all answer with the event as getEvent does.
export const organizer = (action) =>
  async function organizerAction(req, res) {
    res.json(await events.organizerAction(req.deps.store, req.user, req.params.id, action, req.body))
  }

export async function enter(req, res) {
  res.status(201).json({ entry: await submitEntry(req.deps.store, req.user, req.params.id, req.body) })
}

export async function editEntry(req, res) {
  res.json({ entry: await updateEntry(req.deps.store, req.user, req.params.id, req.body) })
}

export async function vote(req, res) {
  res.json(await voteEntry(req.deps.store, req.user, req.params.id, req.body))
}
