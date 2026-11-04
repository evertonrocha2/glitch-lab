import { trackById } from '../../../shared/exams/catalog.js'
import { serverDay } from '../../core/days.js'
import { badRequest, notFound, valueOrThrow } from '../../core/errors.js'
import { MESSAGES, parseExamDate } from './exams.model.js'

function knownTrack(id) {
  const track = trackById(id)
  if (!track) throw notFound(MESSAGES.trackNotFound)
  return track
}

export async function listTracks(store, user) {
  return store.listUserTracks(user.id)
}

// Picks a track, or changes its exam date: { examDate? }. Only a track with an exam has a date.
export async function joinTrack(store, user, id, body) {
  const track = knownTrack(id)
  const examDate = valueOrThrow(parseExamDate(body.examDate, serverDay()))
  if (examDate && !track.exam) throw badRequest(MESSAGES.noExamDate)
  return store.upsertUserTrack(user.id, track.id, { examDate })
}

export async function leaveTrack(store, user, id) {
  const track = knownTrack(id)
  if (!(await store.deleteUserTrack(user.id, track.id))) throw notFound(MESSAGES.trackNotFound)
}
