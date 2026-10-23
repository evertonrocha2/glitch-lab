import { queryText } from '../../core/validation.js'
import * as review from './review.service.js'

export async function today(req, res) {
  res.json(await review.getReview(req.deps.store, req.user, review.todayOf(queryText(req, 'today'))))
}

export async function start(req, res) {
  const body = req.body ?? {}
  const { session, created } = await review.startReview(req.deps.store, req.user, review.todayOf(body.today), req.locale)
  res.status(created ? 201 : 200).json({ session })
}

export async function answer(req, res) {
  const body = req.body ?? {}
  res.json(await review.answerReview(req.deps.store, req.user, review.todayOf(body.today), body))
}
