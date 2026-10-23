import express from 'express'
import { jsonBody } from './core/middlewares/json-body.js'
import { errorHandler } from './core/middlewares/error-handler.js'
import { locale } from './core/middlewares/locale.js'
import { notFound } from './core/middlewares/not-found.js'
import * as defaultAi from './infra/ai/index.js'
import { getStore } from './infra/database/index.js'
import { apiRouter } from './routes.js'

// The whole API as one Express app. store and ai can be swapped (tests, scripts); by default the
// store is picked from the env on first use (Supabase or the local JSON file) and the AI is Gemini.
// Paths outside /api fall through to next(), so the same app mounts inside Vite's dev server.
export function createApp({ store, ai = defaultAi } = {}) {
  const app = express()
  app.disable('x-powered-by')
  // Render and Vercel sit in front: their address, not the visitor's, is the socket's.
  app.set('trust proxy', true)

  app.get('/healthz', (_req, res) => res.json({ ok: true }))

  app.use('/api', jsonBody, locale, (req, _res, next) => {
    // Resolved on first use, so a route that never touches the database never opens one.
    req.deps = {
      get store() {
        return store ?? getStore()
      },
      ai,
    }
    next()
  })
  app.use('/api', apiRouter())
  app.use('/api', notFound)
  app.use('/api', errorHandler)
  return app
}
