import { Router } from 'express'
import { optionalAuth, requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './events.controller.js'

// Community events. Reading works signed out; the organizer tools, entries and votes need a session.
export const eventsRoutes = Router()
  .get('/events', controller.list)
  .post('/events', requireAuth, controller.create)
  .get('/events/:id', optionalAuth, controller.get)
  .patch('/events/:id', requireAuth, controller.organizer('edit'))
  .post('/events/:id/close', requireAuth, controller.organizer('close'))
  .post('/events/:id/winners', requireAuth, controller.organizer('winners'))
  .post('/events/:id/entries', requireAuth, controller.enter)
  .patch('/entries/:id', requireAuth, controller.editEntry)
  .post('/entries/:id/votes', requireAuth, controller.vote)
