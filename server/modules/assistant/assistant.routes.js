import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './assistant.controller.js'

export const assistantRoutes = Router().post('/assistant', requireAuth, controller.question)
