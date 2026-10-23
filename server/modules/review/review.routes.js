import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './review.controller.js'

export const reviewRoutes = Router()
  .get('/review', requireAuth, controller.today)
  .post('/review/sessions', requireAuth, controller.start)
  .post('/review/answers', requireAuth, controller.answer)
