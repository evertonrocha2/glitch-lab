import { clientDay, serverDay } from '../../core/days.js'
import { queryText } from '../../core/validation.js'
import { getProgress } from './progress.service.js'
import { addStudyTime } from './study.service.js'

export async function get(req, res) {
  const today = clientDay(queryText(req, 'today')) ?? serverDay()
  res.json({ progress: await getProgress(req.deps.store, req.user.id, today) })
}

export async function studyTime(req, res) {
  res.json(await addStudyTime(req.deps.store, req.user, req.body))
}
