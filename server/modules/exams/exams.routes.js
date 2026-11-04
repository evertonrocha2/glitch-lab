import { Router } from 'express'
import { requireAuth } from '../../core/middlewares/auth.js'
import * as controller from './exams.controller.js'

// Study tracks (ENEM, programming...) and exam practice: the catalog, a topic's real questions and
// answering them. The official answer only leaves the server once the student has answered.
export const examsRoutes = Router()
  .get('/tracks', requireAuth, controller.listTracks)
  .put('/tracks/:id', requireAuth, controller.joinTrack)
  .delete('/tracks/:id', requireAuth, controller.leaveTrack)
  .get('/exams/:exam', requireAuth, controller.overview)
  .get('/exams/:exam/topics/:topic/questions', requireAuth, controller.topicQuestions)
  .post('/exam-questions/:id/answer', requireAuth, controller.answer)
