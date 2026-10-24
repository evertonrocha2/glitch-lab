import { Router } from 'express'
import { articlesRoutes } from './modules/articles/articles.routes.js'
import { assistantRoutes } from './modules/assistant/assistant.routes.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { casesRoutes } from './modules/cases/cases.routes.js'
import { challengesRoutes } from './modules/challenges/challenges.routes.js'
import { cronRoutes } from './modules/cron/cron.routes.js'
import { dailyRoutes } from './modules/daily/daily.routes.js'
import { duelsRoutes } from './modules/duels/duels.routes.js'
import { eventsRoutes } from './modules/events/events.routes.js'
import { glitchdleRoutes } from './modules/glitchdle/glitchdle.routes.js'
import { huntRoutes } from './modules/hunt/hunt.routes.js'
import { interrogationRoutes } from './modules/interrogation/interrogation.routes.js'
import { notesRoutes } from './modules/notes/notes.routes.js'
import { profileRoutes } from './modules/profile/profile.routes.js'
import { progressRoutes } from './modules/progress/progress.routes.js'
import { questionsRoutes } from './modules/questions/questions.routes.js'
import { reviewRoutes } from './modules/review/review.routes.js'
import { studyRoutes } from './modules/study/study.routes.js'
import { trailsRoutes } from './modules/trails/trails.routes.js'
import { communitiesRoutes } from './modules/communities/communities.routes.js'
import { messagesRoutes } from './modules/messages/messages.routes.js'

// Every feature module's router, all under /api. Each one names its own paths in full.
export function apiRouter() {
  return Router().use(
    authRoutes,
    profileRoutes,
    casesRoutes,
    interrogationRoutes,
    challengesRoutes,
    dailyRoutes,
    glitchdleRoutes,
    huntRoutes,
    duelsRoutes,
    notesRoutes,
    progressRoutes,
    reviewRoutes,
    studyRoutes,
    trailsRoutes,
    articlesRoutes,
    eventsRoutes,
    assistantRoutes,
    questionsRoutes,
    messagesRoutes,
    communitiesRoutes,
    cronRoutes,
  )
}
