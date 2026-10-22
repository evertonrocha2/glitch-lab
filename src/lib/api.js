const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

// Thrown on 401 so pages can send the person back to the login screen.
export class AuthError extends Error {}

async function request(path, { method = 'GET', body, token, keepalive } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(path, { method, headers, keepalive, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new Error('Could not reach the server. Check your connection.')
  }

  const data = await res.json().catch(() => null)
  if (res.status === 401) throw new AuthError(data?.message || 'Sign in to continue.')
  if (!res.ok || !data) throw new Error(data?.message || GENERIC_MESSAGE)
  return data
}

// Each returns the signed session: { token, user }.
export function signIn({ email, password }) {
  return request('/api/login', { method: 'POST', body: { email, password } })
}

export function signUp({ email, password }) {
  return request('/api/register', { method: 'POST', body: { email, password } })
}

// today: the visitor's date, so the sample study streak matches their clock.
export function startDemo(today) {
  return request('/api/demo', { method: 'POST', body: { today } })
}

export async function analyzeError({ error, code }, token) {
  return (await request('/api/analyze', { method: 'POST', body: { error, code }, token })).case
}

export async function listCases(token) {
  return (await request('/api/cases', { token })).cases
}

export async function startChallenge(caseId, token) {
  return (await request('/api/challenge', { method: 'POST', body: { caseId }, token })).challenge
}

export async function getChallenge(id, token) {
  return (await request(`/api/challenge?id=${encodeURIComponent(id)}`, { token })).challenge
}

// { hint, hintsRevealed }
export function revealHint(challengeId, token) {
  return request('/api/hint', { method: 'POST', body: { challengeId }, token })
}

// { passed, feedback, case }
export function checkFix(challengeId, code, token) {
  return request('/api/check', { method: 'POST', body: { challengeId, code }, token })
}

export async function listNotes(token) {
  return (await request('/api/notes', { token })).notes
}

export async function createNote({ title, blocks }, token) {
  return (await request('/api/notes', { method: 'POST', body: { title, blocks }, token })).note
}

export async function updateNote(id, { title, blocks }, token, { keepalive = false } = {}) {
  return (await request('/api/notes', { method: 'PUT', body: { id, title, blocks }, token, keepalive })).note
}

export async function deleteNote(id, token) {
  await request(`/api/notes?id=${encodeURIComponent(id)}`, { method: 'DELETE', token })
}

// keepalive lets the last report go out while the tab is closing. Returns today's total in seconds.
export async function addStudyTime({ seconds, day }, token, { keepalive = false } = {}) {
  return (await request('/api/study', { method: 'POST', body: { seconds, day }, token, keepalive })).todaySeconds
}

export async function getProgress(today, token) {
  return (await request(`/api/progress?today=${encodeURIComponent(today)}`, { token })).progress
}
