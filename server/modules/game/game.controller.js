import { clientDay, serverDay } from '../../core/days.js'
import { queryText, requireBody } from '../../core/validation.js'
import * as game from './game.service.js'

const todayOf = (req) => clientDay(queryText(req, 'today')) ?? serverDay()

export async function show(req, res) {
  res.json(await game.getGame(req.deps.store, req.user, todayOf(req)))
}

export async function sync(req, res) {
  res.json(await game.sync(req.deps.store, req.user, todayOf(req)))
}

export async function hunt(req, res) {
  res.json(await game.startHunt(req.deps.store, req.user, todayOf(req), requireBody(req)))
}

export async function stopHunt(req, res) {
  res.json(await game.stopHunt(req.deps.store, req.user, todayOf(req)))
}

export async function boss(req, res) {
  res.json(await game.fightBoss(req.deps.store, req.user, todayOf(req), requireBody(req)))
}
