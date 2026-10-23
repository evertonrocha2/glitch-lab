import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './glitchdle.controller.js'

export const glitchdleRoutes = Router()
  .get('/glitchdle', requireAuth, controller.today)
  .post('/glitchdle/guesses', requireAuth, controller.guess)
