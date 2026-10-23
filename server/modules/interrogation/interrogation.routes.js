import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './interrogation.controller.js'

// Guided debugging on one of my cases.
export const interrogationRoutes = Router()
  .get('/cases/:caseId/interrogation', requireAuth, controller.get)
  .post('/cases/:caseId/interrogation/answers', requireAuth, controller.answer)
