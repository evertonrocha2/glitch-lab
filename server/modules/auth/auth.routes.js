import { Router } from 'express'
import { demoLoginEnabled } from '../../config/env.js'
import * as controller from './auth.controller.js'

// With the demo login off, the demo path skips to the 404 like any path no module answers.
const whenDemoLogin = (_req, _res, next) => next(demoLoginEnabled() ? undefined : 'route')

export const authRoutes = Router()
  .post('/auth/login', controller.login)
  .post('/auth/register', controller.register)
  .post('/auth/demo', whenDemoLogin, controller.demo)
