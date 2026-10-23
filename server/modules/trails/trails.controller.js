import { clientDay, serverDay } from '../../core/days.js'
import * as trails from './trails.service.js'

export async function page(req, res) {
  res.json(await trails.getTrailPage(req.deps.store, req.user))
}

export async function build(req, res) {
  const today = clientDay(req.body?.today) ?? serverDay()
  res.status(201).json(await trails.buildTrail(req.deps, req.user, today, req.locale))
}

export async function setMission(req, res) {
  const { trailId, missionId } = req.params
  res.json({ trail: await trails.setMissionDone(req.deps.store, req.user, trailId, missionId, req.body) })
}
