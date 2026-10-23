import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

const ROUTE_NAME = /^[a-z-]+$/

// Dev only: serve every api/<name>.js the way Vercel does, so `bun run dev` works without `vercel dev`.
// The env (with the API key) stays in this Node process; the browser never sees it.
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
      for (const [key, value] of Object.entries(env)) {
        process.env[key] ??= value
      }
      server.middlewares.use('/api', async (req, res) => {
        try {
          // Mounted at /api, so req.url is "/<name>?query".
          const url = new URL(req.url, 'http://localhost')
          const name = url.pathname.replace(/^\/+|\/+$/g, '')
          if (!ROUTE_NAME.test(name) || !existsSync(resolve(server.config.root, 'api', `${name}.js`))) {
            res.statusCode = 404
            res.end()
            return
          }
          const handler = (await server.ssrLoadModule(`/api/${name}.js`))[req.method]
          if (typeof handler !== 'function') {
            res.statusCode = 405
            res.end()
            return
          }

          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const headers = {}
          if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type']
          if (req.headers.authorization) headers.Authorization = req.headers.authorization
          if (req.headers['accept-language']) headers['Accept-Language'] = req.headers['accept-language']
          const hasBody = !['GET', 'HEAD'].includes(req.method)

          const response = await handler(
            new Request(`http://localhost/api/${name}${url.search}`, {
              method: req.method,
              headers,
              body: hasBody ? Buffer.concat(chunks) : undefined,
            }),
          )
          res.statusCode = response.status
          res.setHeader('Content-Type', response.headers.get('Content-Type') ?? 'application/json')
          res.end(await response.text())
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
