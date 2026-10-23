import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { vi } from 'vitest'
import { createApp } from '../../server/app.js'
import { getStore, resetStore } from '../../server/infra/database/index.js'
import { createToken } from '../../server/infra/security/session.js'

// Points the API at a fresh JSON store in a temp folder and returns it.
export async function useTempStore() {
  vi.stubEnv('LOCAL_STORE_FILE', join(await mkdtemp(join(tmpdir(), 'gd-api-')), 'db.json'))
  resetStore()
  return getStore()
}

// A real signed session for a test user; "demo" is a demo account.
export const sessionFor = (id) => createToken({ id, email: `${id}@test.dev`, isDemo: id === 'demo' })

// One app for every test: the store is picked per request (after useTempStore), and the AI is the
// real Gemini client, so tests mock it by stubbing fetch.
const app = createApp()

// Sends one request through the Express app and answers with a fetch Response.
// token: 'dev:<id>' signs in as that test user, null sends no Authorization header, anything else is sent as is.
// locale: the Accept-Language the app sends ('pt-BR' for a Portuguese reader); none means English.
// body: an object is sent as JSON, a string as is (to test broken JSON).
export async function api(url, { method = 'POST', body, token = 'dev:alice', locale, headers = {} } = {}) {
  let call = request(app)[method.toLowerCase()](url)
  if (locale) call = call.set('Accept-Language', locale)
  if (token) call = call.set('Authorization', `Bearer ${token.startsWith('dev:') ? sessionFor(token.slice(4)) : token}`)
  for (const [key, value] of Object.entries(headers)) call = call.set(key, value)
  if (body !== undefined) call = call.set('Content-Type', 'application/json').send(typeof body === 'string' ? body : JSON.stringify(body))
  const res = await call
  const responseHeaders = new Headers()
  for (const [key, value] of Object.entries(res.headers)) responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : String(value))
  return new Response(res.text, { status: res.status, headers: responseHeaders })
}

// A Gemini generateContent response whose text is the given value (objects become JSON).
export function geminiAnswer(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }))
}

// A fetch that only settles when the AI layer's time limit aborts it.
export function neverAnswers() {
  return (_url, init) =>
    new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)))
}
