import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './messages.controller.js'

// Direct messages (1:1), blocks and reports. Everything here needs a session.
export const messagesRoutes = Router()
  .get('/conversations', requireAuth, controller.list)
  .post('/conversations', requireAuth, controller.start)
  // The nav badge: how many conversations have unread messages.
  .get('/conversations/unread', requireAuth, controller.unread)
  .get('/conversations/:id/messages', requireAuth, controller.messages)
  .post('/conversations/:id/messages', requireAuth, controller.send)
  .post('/conversations/:id/read', requireAuth, controller.read)
  // "Who can message me", and whether I can message someone (for the button on their profile).
  .get('/messaging/settings', requireAuth, controller.getSettings)
  .patch('/messaging/settings', requireAuth, controller.saveSettings)
  .get('/messaging/with/:handle', requireAuth, controller.withPerson)
  .post('/blocks', requireAuth, controller.block)
  .delete('/blocks', requireAuth, controller.unblock)
  .post('/reports', requireAuth, controller.report)
