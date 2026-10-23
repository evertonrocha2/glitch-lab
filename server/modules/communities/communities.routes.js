import { Router } from 'express'
import { optionalAuth, requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './communities.controller.js'

// Communities. Reading a public one works signed out (and for demo accounts); joining, posting
// and creating need a real account.
export const communitiesRoutes = Router()
  .get('/communities', optionalAuth, controller.list)
  .post('/communities', requireAuth, controller.create)
  .get('/communities/:slug', optionalAuth, controller.get)
  .post('/communities/:slug/join', requireAuth, controller.join)
  .post('/communities/:slug/leave', requireAuth, controller.leave)
  .get('/communities/:slug/messages', optionalAuth, controller.messages)
  .post('/communities/:slug/messages', requireAuth, controller.post)
  .delete('/communities/:slug/members/:userId', requireAuth, controller.removeMember)
  .delete('/community-messages/:id', requireAuth, controller.deleteMessage)
