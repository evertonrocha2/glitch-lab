import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './hunt.controller.js'

export const huntRoutes = Router()
  .get('/hunt', requireAuth, controller.today)
  .post('/hunt/start', requireAuth, controller.action('start'))
  .post('/hunt/answers', requireAuth, controller.action('answer'))
  .post('/hunt/next', requireAuth, controller.action('next'))
  .get('/hunt/practice', requireAuth, controller.practice)
  .post('/hunt/practice/answers', requireAuth, controller.practiceAnswer)
