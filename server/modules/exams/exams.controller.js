import { idParam } from '../../core/validation.js'
import * as tracks from './tracks.service.js'

export async function listTracks(req, res) {
  res.json({ tracks: await tracks.listTracks(req.deps.store, req.user) })
}

export async function joinTrack(req, res) {
  res.json({ track: await tracks.joinTrack(req.deps.store, req.user, idParam(req), req.body ?? {}) })
}

export async function leaveTrack(req, res) {
  await tracks.leaveTrack(req.deps.store, req.user, idParam(req))
  res.json({ deleted: true })
}
