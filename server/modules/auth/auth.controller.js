import { clientDay, serverDay } from '../../core/days.js'
import * as auth from './auth.service.js'

export async function login(req, res) {
  res.json(await auth.login(req.deps.store, req.body))
}

export async function register(req, res) {
  res.status(201).json(await auth.register(req.deps.store, req.body))
}

// today: the visitor's date, so the sample study streak matches their clock.
export async function demo(req, res) {
  const today = clientDay(req.body?.today) ?? serverDay()
  res.status(201).json(await auth.startDemo(req.deps.store, { today, locale: req.locale }))
}
