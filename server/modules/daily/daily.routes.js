import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './daily.controller.js'

// Daily puzzles and the weekly global challenge. Starting one opens a gym challenge
// (/api/challenges/:id), so hints and the fix check are the same as for a case.
export const dailyRoutes = Router()
  .get('/daily', requireAuth, controller.today)
  .get('/daily/weekly', requireAuth, controller.weekly)
  .post('/daily/puzzles/:puzzleId/challenge', requireAuth, controller.startPuzzle)
