import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { vi } from 'vitest'
import { createToken } from '../../server/infra/security/session.js'
import { getStore, resetStore } from '../../server/infra/database/index.js'

// Points the API at a fresh JSON store in a temp folder and returns it.
export async function useTempStore() {
  vi.stubEnv('LOCAL_STORE_FILE', join(await mkdtemp(join(tmpdir(), 'gd-api-')), 'db.json'))
  resetStore()
  return getStore()
}

// A real signed session for a test user; "demo" is a demo account.
export const sessionFor = (id) => createToken({ id, email: `${id}@test.dev`, isDemo: id === 'demo' })

// token: 'dev:<id>' signs in as that test user, null sends no Authorization header, anything else is sent as is.
// locale: the Accept-Language the app sends ('pt-BR' for a Portuguese reader); none means English.
export function apiRequest(url, { method = 'POST', body, token = 'dev:alice', locale } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (locale) headers['Accept-Language'] = locale
  if (token) headers.Authorization = `Bearer ${token.startsWith('dev:') ? sessionFor(token.slice(4)) : token}`
  const payload = body === undefined || typeof body === 'string' ? body : JSON.stringify(body)
  return new Request(`http://localhost${url}`, { method, headers, body: payload })
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
