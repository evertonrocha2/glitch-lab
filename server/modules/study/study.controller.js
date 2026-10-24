import { idParam, queryText, requireBody } from '../../core/validation.js'
import * as study from './study.service.js'

export async function list(req, res) {
  const range = { from: queryText(req, 'from') ?? undefined, to: queryText(req, 'to') ?? undefined }
  res.json(await study.listSessions(req.deps.store, req.user, range))
}

export async function create(req, res) {
  res.status(201).json({ session: await study.createManual(req.deps.store, req.user, requireBody(req)) })
}

export async function start(req, res) {
  res.status(201).json({ session: await study.startSession(req.deps.store, req.user, requireBody(req)) })
}

// null when the run was too short to keep.
export async function stop(req, res) {
  res.json({ session: await study.stopSession(req.deps.store, req.user, idParam(req), req.body ?? {}) })
}

export async function update(req, res) {
  res.json({ session: await study.updateSession(req.deps.store, req.user, idParam(req), requireBody(req)) })
}

export async function remove(req, res) {
  await study.deleteSession(req.deps.store, req.user, idParam(req))
  res.json({ deleted: true })
}
