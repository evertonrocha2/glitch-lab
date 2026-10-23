import { Router } from 'express'
import { optionalAuth, requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './profile.controller.js'

export const profileRoutes = Router()
  // My own profile, for the editor.
  .get('/me', requireAuth, controller.getOwn)
  .patch('/me', requireAuth, controller.update)
  // Public pages: anyone can look; signed in, your own private page comes back as a preview.
  .get('/profiles', controller.search)
  .get('/profiles/:handle', optionalAuth, controller.getPublic)
