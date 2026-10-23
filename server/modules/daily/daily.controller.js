import { idParam } from '../../core/validation.js'
import * as daily from './daily.service.js'

export async function today(req, res) {
  res.json(await daily.getDaily(req.deps.store, req.user, req.locale))
}

export async function weekly(req, res) {
  res.json(await daily.getWeekly(req.deps.store, req.user, req.locale))
}

export async function startPuzzle(req, res) {
  const { challenge, created } = await daily.startPuzzle(req.deps.store, req.user, idParam(req, 'puzzleId'), req.locale)
  res.status(created ? 201 : 200).json({ challenge })
}
