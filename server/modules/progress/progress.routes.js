import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './progress.controller.js'

export const progressRoutes = Router()
  .get('/progress', requireAuth, controller.get)
  // The study timer reports time (keepalive, so the last report goes out as the tab closes).
  .post('/progress/study-time', requireAuth, controller.studyTime)
