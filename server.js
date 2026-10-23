// Production server for hosts that run one Node process (Render): serves the built app from dist/
// and every api/<name>.js the way Vercel does, so the same handlers run everywhere.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname)
const DIST = join(ROOT, 'dist')
const ROUTE_NAME = /^[a-z-]+$/
const MAX_BODY = 1024 * 1024
const FORWARDED = ['content-type', 'authorization', 'accept-language']
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

const routes = new Map()
async function route(name) {
  if (!routes.has(name)) routes.set(name, await import(pathToFileURL(join(ROOT, 'api', `${name}.js`)).href))
  return routes.get(name)
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw Object.assign(new Error('Body too large'), { status: 413 })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function api(req, res, url) {
  const name = url.pathname.slice('/api/'.length).replace(/\/+$/, '')
  if (!ROUTE_NAME.test(name) || !existsSync(join(ROOT, 'api', `${name}.js`))) return send(res, 404, { message: 'Not found.' })
  const handler = (await route(name))[req.method]
  if (typeof handler !== 'function') return send(res, 405, { message: 'Method not allowed.' })

  // Only what the handlers read; hop-by-hop headers (host, connection, content-length) stay behind.
  const headers = new Headers()
  for (const key of FORWARDED) if (typeof req.headers[key] === 'string') headers.set(key, req.headers[key])
  const hasBody = !['GET', 'HEAD'].includes(req.method)
  const response = await handler(
    new Request(new URL(`${url.pathname}${url.search}`, 'http://localhost'), { method: req.method, headers, body: hasBody ? await readBody(req) : undefined }),
  )
  res.statusCode = response.status
  for (const [key, value] of response.headers) res.setHeader(key, value)
  res.end(Buffer.from(await response.arrayBuffer()))
}

function file(res, path) {
  const type = TYPES[extname(path)] ?? 'application/octet-stream'
  res.statusCode = 200
  res.setHeader('Content-Type', type)
  // Vite fingerprints everything in assets/, so those can be cached for good; index.html never.
  res.setHeader('Cache-Control', path.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache')
  res.end(readFileSync(path))
}

function staticFile(res, url) {
  const path = resolve(DIST, `.${decodeURIComponent(url.pathname)}`)
  // Anything outside dist/ (../ tricks) or not a file falls back to the app, which routes on its own.
  if (path.startsWith(DIST + sep) && existsSync(path) && statSync(path).isFile()) return file(res, path)
  return file(res, join(DIST, 'index.html'))
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname === '/healthz') return send(res, 200, { ok: true })
    if (url.pathname.startsWith('/api/')) return await api(req, res, url)
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { message: 'Method not allowed.' })
    return staticFile(res, url)
  } catch (err) {
    if (err.status === 413) return send(res, 413, { message: 'Request too large.' })
    console.error(err)
    if (!res.headersSent) send(res, 500, { message: 'Server error.' })
    else res.end()
  }
}).listen(Number(process.env.PORT ?? 3000), () => console.log(`Glitch Lab on :${process.env.PORT ?? 3000}`))
