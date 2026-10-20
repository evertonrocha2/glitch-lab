import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Dev only: serve api/analyze.js the way Vercel does, so `bun run dev` works without `vercel dev`.
// The env (with the API key) stays in this Node process; the browser never sees it.
function localApi() {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      for (const [key, value] of Object.entries(loadEnv(server.config.mode, process.cwd(), ''))) {
        process.env[key] ??= value
      }
      server.middlewares.use('/api/analyze', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const { POST } = await server.ssrLoadModule('/api/analyze.js')
        const response = await POST(
          new Request('http://localhost/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': req.headers['content-type'] ?? 'application/json' },
            body: Buffer.concat(chunks),
          }),
        )
        res.statusCode = response.status
        res.setHeader('Content-Type', response.headers.get('Content-Type') ?? 'application/json')
        res.end(await response.text())
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localApi()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
})
