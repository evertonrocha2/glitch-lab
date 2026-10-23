import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './trails.controller.js'

// The study trail page: the active trail, the last few finished ones, and what they're built from.
export const trailsRoutes = Router()
  .get('/trails', requireAuth, controller.page)
  .post('/trails', requireAuth, controller.build)
  .patch('/trails/:trailId/missions/:missionId', requireAuth, controller.setMission)
