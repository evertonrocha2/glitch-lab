import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './study.controller.js'

// The study log. The timer opens a session when it starts and closes it when it stops; the
// seconds in between arrive with its usual reports (POST /progress/study-time with a sessionId).
export const studyRoutes = Router()
  .get('/study/sessions', requireAuth, controller.list)
  .post('/study/sessions', requireAuth, controller.create)
  .post('/study/sessions/start', requireAuth, controller.start)
  // Sent with keepalive too, so a run that ends as the tab closes still gets closed.
  .post('/study/sessions/:id/stop', requireAuth, controller.stop)
  .patch('/study/sessions/:id', requireAuth, controller.update)
  .delete('/study/sessions/:id', requireAuth, controller.remove)
