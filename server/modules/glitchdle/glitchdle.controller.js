import * as glitchdle from './glitchdle.service.js'

export async function today(req, res) {
  res.json(await glitchdle.getRiddle(req.deps.store, req.user))
}

export async function guess(req, res) {
  res.json(await glitchdle.guessRiddle(req.deps.store, req.user, req.body))
}
