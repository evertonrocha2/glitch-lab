import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { vi } from 'vitest'
import { getStore, resetStore } from '../../api/_lib/store/index.js'

// Points the API at a fresh JSON store in a temp folder and returns it.
export async function useTempStore() {
  vi.stubEnv('LOCAL_STORE_FILE', join(await mkdtemp(join(tmpdir(), 'gd-api-')), 'db.json'))
  resetStore()
  return getStore()
}

// token: 'dev:<id>' to sign in, null to send no Authorization header.
export function apiRequest(url, { method = 'POST', body, token = 'dev:alice' } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
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
