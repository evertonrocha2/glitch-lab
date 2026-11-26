import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './game.controller.js'

// Glitch World v2: the idle hero. The client sends intents only; the server rolls every result.
export const gameRoutes = Router()
  .get('/game', requireAuth, controller.show)
  .post('/game/sync', requireAuth, controller.sync)
  .post('/game/hunt', requireAuth, controller.hunt)
  .post('/game/hunt/stop', requireAuth, controller.stopHunt)
  .post('/game/boss', requireAuth, controller.boss)
