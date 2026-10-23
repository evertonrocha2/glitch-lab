import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './questions.controller.js'

// "Ask a question": one streamed tutor turn. The card it proposes is made with POST /cases/from-question.
export const questionsRoutes = Router().post('/questions/stream', requireAuth, controller.stream)
