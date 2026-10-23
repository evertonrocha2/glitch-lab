import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './duels.controller.js'

// The server owns the clock: every move is timed when its request arrives.
export const duelsRoutes = Router()
  .get('/duels', requireAuth, controller.lobby)
  .post('/duels', requireAuth, controller.move('create'))
  .post('/duels/queue', requireAuth, controller.move('queue'))
  .post('/duels/bot', requireAuth, controller.move('bot'))
  .post('/duels/join', requireAuth, controller.move('join'))
  .get('/duels/:id', requireAuth, controller.get)
  .post('/duels/:id/join', requireAuth, controller.move('join'))
  .post('/duels/:id/answers', requireAuth, controller.move('answer'))
  .post('/duels/:id/focus', requireAuth, controller.move('focus'))
  .post('/duels/:id/leave', requireAuth, controller.move('leave'))
  .post('/duels/:id/rematch', requireAuth, controller.move('rematch'))
