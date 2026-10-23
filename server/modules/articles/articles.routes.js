import { Router } from 'express'
import { optionalAuth, requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './articles.controller.js'

// Community articles. Reading works signed out; everything else needs a session.
export const articlesRoutes = Router()
  .get('/articles', controller.search)
  .post('/articles', requireAuth, controller.create)
  .get('/articles/:id', optionalAuth, controller.get)
  .patch('/articles/:id', requireAuth, controller.update)
  .delete('/articles/:id', requireAuth, controller.remove)
  .get('/articles/:id/comments', controller.listComments)
  .post('/articles/:id/comments', requireAuth, controller.addComment)
  .post('/articles/:id/reactions', requireAuth, controller.reaction)
  .delete('/comments/:id', requireAuth, controller.deleteComment)
  // The bell: who liked, rated or commented on my articles, and my event news.
  .get('/notifications', requireAuth, controller.listNotifications)
  .post('/notifications/read', requireAuth, controller.markRead)
