import { requireBody } from '../../core/validation.js'
import * as world from './world.service.js'

export async function show(req, res) {
  res.json(await world.getWorld(req.deps.store, req.user))
}

export async function savePosition(req, res) {
  res.json(await world.savePosition(req.deps.store, req.user, requireBody(req)))
}
