import * as challenges from './challenges.service.js'

export async function start(req, res) {
  const { challenge, created } = await challenges.startChallenge(req.deps, req.user, req.body, req.locale)
  res.status(created ? 201 : 200).json({ challenge })
}

export async function get(req, res) {
  res.json({ challenge: await challenges.getChallenge(req.deps.store, req.user, req.params.id, req.locale) })
}

export async function hint(req, res) {
  res.json(await challenges.revealHint(req.deps.store, req.user, req.params.id, req.locale))
}

export async function check(req, res) {
  res.json(await challenges.checkFix(req.deps, req.user, req.params.id, req.body, req.locale))
}
