import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './cases.controller.js'

export const casesRoutes = Router()
  .get('/cases', requireAuth, controller.list)
  .post('/cases/analyze', requireAuth, controller.analyze)
