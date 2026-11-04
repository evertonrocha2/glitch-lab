import { idParam, queryText } from '../../core/validation.js'
import * as exams from './exams.service.js'
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

export async function overview(req, res) {
  res.json({ exam: await exams.getExamOverview(req.deps.store, req.user, idParam(req, 'exam')) })
}

export async function topicQuestions(req, res) {
  res.json(await exams.listTopicQuestions(req.deps.store, req.user, idParam(req, 'exam'), idParam(req, 'topic'), queryText(req, 'page')))
}

export async function answer(req, res) {
  res.json(await exams.answerQuestion(req.deps.store, req.user, idParam(req), req.body ?? {}))
}
