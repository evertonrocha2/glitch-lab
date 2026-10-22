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
  return request('/api/auth?action=login', { method: 'POST', body: { email, password } })
}

export function signUp({ email, password }) {
  return request('/api/auth?action=register', { method: 'POST', body: { email, password } })
}

// today: the visitor's date, so the sample study streak matches their clock.
export function startDemo(today) {
  return request('/api/auth?action=demo', { method: 'POST', body: { today } })
}

// files and context are optional extras from the form.
export async function analyzeError({ error, code, context, files }, token) {
  return (await request('/api/analyze', { method: 'POST', body: { error, code, context, files }, token })).case
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
  return (await request('/api/progress', { method: 'POST', body: { seconds, day }, token, keepalive })).todaySeconds
}

export async function getProgress(today, token) {
  return (await request(`/api/progress?today=${encodeURIComponent(today)}`, { token })).progress
}

// The study trail page: { trail (or null), history, sources: { cases, notes } }.
export function getTrail(token) {
  return request('/api/trail', { token })
}

// Asks the AI for a new trail (slow: the free AI can take a minute). Same shape as getTrail.
export function buildTrail(today, token) {
  return request('/api/trail', { method: 'POST', body: { today }, token })
}

// Ticks or unticks a reflect mission; returns the updated trail.
export async function setTrailMission({ trailId, missionId, done }, token) {
  return (await request('/api/trail', { method: 'PUT', body: { trailId, missionId, done }, token })).trail
}

// "Ask the detective": { reply, parts, actions, agents, steps }.
export function askAssistant({ messages, page }, token) {
  return request('/api/assistant', { method: 'POST', body: { messages, page }, token })
}

// { profile, earnedBadges, progress } for the profile editor.
export function getMyProfile(today, token) {
  return request(`/api/profile?today=${encodeURIComponent(today)}`, { token })
}

// Sends only the fields that changed; returns the saved profile.
export async function saveProfile(patch, token) {
  return (await request('/api/profile', { method: 'PUT', body: patch, token })).profile
}

// Anyone can look, signed in or not. null when the handle has no public profile (missing or private).
export async function getPublicProfile(handle, today) {
  const path = `/api/profile?handle=${encodeURIComponent(handle)}&today=${encodeURIComponent(today)}`
  let res
  try {
    res = await fetch(path, { method: 'GET', headers: {} })
  } catch {
    throw new Error('Could not reach the server. Check your connection.')
  }
  if (res.status === 404) return null
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) throw new Error(data?.message || GENERIC_MESSAGE)
  return data.profile
}

// Public pages (notes on a profile, people search) work signed out: no token, and 404 means "not shared".
async function publicGet(path) {
  let res
  try {
    res = await fetch(path, { method: 'GET', headers: {} })
  } catch {
    throw new Error('Could not reach the server. Check your connection.')
  }
  if (res.status === 404) return null
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) throw new Error(data?.message || GENERIC_MESSAGE)
  return data
}

// Shows or hides a note on your public profile. Returns the saved note.
export async function setNotePublic(id, isPublic, token) {
  return (await request('/api/notes', { method: 'PUT', body: { id, isPublic }, token })).note
}

// [{ id, title, updatedAt, excerpt, blockCount }], or null when the profile isn't public.
export async function listPublicNotes(handle) {
  return (await publicGet(`/api/notes?handle=${encodeURIComponent(handle)}`))?.notes ?? null
}

// { note, author } for one shared note, or null when it isn't shared.
export function getPublicNote(handle, id) {
  return publicGet(`/api/notes?handle=${encodeURIComponent(handle)}&id=${encodeURIComponent(id)}`)
}

// Up to 20 public profile cards whose handle or name matches. An empty query lists the newest.
export async function searchProfiles(query) {
  return (await publicGet(`/api/profile?search=${encodeURIComponent(query)}`))?.profiles ?? []
}
