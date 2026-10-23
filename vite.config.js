import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Dev only: the Express API (server/app.js) runs inside Vite's dev server under /api, so
// `bun run dev` is the whole app. The env (with the API key) stays in this Node process; the
// browser never sees it.
function localApi() {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      // Vitest runs this hook too: tests never read .env, so they can't touch the real database.
      if (process.env.VITEST) return
      const env = loadEnv(server.config.mode, process.cwd(), '')
      // Dev keeps the local JSON store unless DEV_SUPABASE=1, so trying things out never writes to production.
      if (env.DEV_SUPABASE !== '1' && process.env.DEV_SUPABASE !== '1') delete env.SUPABASE_SERVICE_ROLE_KEY
      // The paid AI too: trying pages out, or an agent taking screenshots, never spends credits unless
      // DEV_AI=1. Without the key the provider chain moves straight on to the free one, with no request.
      if (env.DEV_AI !== '1' && process.env.DEV_AI !== '1') delete env.OPENROUTER_API_KEY
      for (const [key, value] of Object.entries(env)) {
        process.env[key] ??= value
      }

      // Loaded through Vite, so an edit under server/ applies on the next request without a restart.
      // One app per loaded version of the module.
      const apps = new WeakMap()
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api' && !req.url.startsWith('/api/') && !req.url.startsWith('/api?')) return next()
        try {
          const module = await server.ssrLoadModule('/server/app.js')
          if (!apps.has(module)) apps.set(module, module.createApp())
          apps.get(module)(req, res, next)
        } catch (err) {
          console.error(err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: 'Server error.' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localApi()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    // Agent worktrees live under .claude/; their copies of the tests aren't ours to run.
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
})
