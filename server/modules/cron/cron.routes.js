import { Router } from 'express'
import { daily, requireCronSecret } from './cron.controller.js'

export const cronRoutes = Router()
  .post('/cron/daily', requireCronSecret, daily)
  // The old URL, kept for one release so a cron still calling it keeps working.
  .get('/challenge', (req, _res, next) => (req.query.cron !== undefined ? next() : next('route')), requireCronSecret, daily)
