import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './world.controller.js'

// Glitch World: the worlds and zones the student's study opened, and where their hero stands.
export const worldRoutes = Router()
  .get('/world', requireAuth, controller.show)
  .put('/world/position', requireAuth, controller.savePosition)
