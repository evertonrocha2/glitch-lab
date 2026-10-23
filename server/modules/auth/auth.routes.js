import { Router } from 'express'
import * as controller from './auth.controller.js'

export const authRoutes = Router()
  .post('/auth/login', controller.login)
  .post('/auth/register', controller.register)
  .post('/auth/demo', controller.demo)
