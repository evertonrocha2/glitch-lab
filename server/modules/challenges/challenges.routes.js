import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './challenges.controller.js'

// The gym: a challenge built from one of my cases (or a daily puzzle), its hints and the fix check.
export const challengesRoutes = Router()
  .post('/challenges', requireAuth, controller.start)
  .get('/challenges/:id', requireAuth, controller.get)
  .post('/challenges/:id/hints', requireAuth, controller.hint)
  .post('/challenges/:id/check', requireAuth, controller.check)
