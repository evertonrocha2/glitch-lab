import * as duels from './duels.service.js'
import { localizeDuel } from './view.js'

export async function lobby(req, res) {
  res.json(await duels.getLobby(req.deps.store, req.user))
}

// Both players see the same rounds, each in their own language.
export async function get(req, res) {
  const { duel } = await duels.getDuel(req.deps.store, req.user, req.params.id)
  res.json({ duel: localizeDuel(duel, req.locale) })
}

// One move. The duel id comes from the path when there is one; the rest from the body.
export const move = (action) =>
  async function duelMove(req, res) {
    const fields = req.params.id === undefined ? (req.body ?? {}) : { ...req.body, id: req.params.id }
    const { created, ...body } = await duels.duelAction(req.deps.store, req.user, action, fields)
    res.status(created ? 201 : 200).json(body.duel ? { ...body, duel: localizeDuel(body.duel, req.locale) } : body)
  }
