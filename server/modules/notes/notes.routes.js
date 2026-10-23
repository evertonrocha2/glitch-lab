import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './notes.controller.js'

export const notesRoutes = Router()
  .get('/notes', requireAuth, controller.list)
  .post('/notes', requireAuth, controller.create)
  .patch('/notes/:id', requireAuth, controller.update)
  .delete('/notes/:id', requireAuth, controller.remove)
  // Notes shared on a public profile: anyone can read them, signed in or not.
  .get('/profiles/:handle/notes', controller.listPublic)
  .get('/profiles/:handle/notes/:id', controller.getPublic)
