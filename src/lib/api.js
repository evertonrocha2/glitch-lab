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

// Community articles. Reading works signed out (token may be null); everything else needs a token.
const COMMUNITY = '/api/community?resource='

// { articles, page, hasMore }. Only the filters that are set go in the URL.
export function listArticles({ q, tag, author, sort, page } = {}, token) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ q, tag, author, sort, page })) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  return request(`${COMMUNITY}articles${query ? `&${query}` : ''}`, { token })
}

// { article, comments, reaction } (reaction is null when signed out).
export function getArticle(id, token) {
  return request(`${COMMUNITY}articles&id=${encodeURIComponent(id)}`, { token })
}

export async function createArticle({ title, body, tags, caseId }, token) {
  return (await request(`${COMMUNITY}articles`, { method: 'POST', body: { title, body, tags, caseId }, token })).article
}

export async function updateArticle(id, fields, token) {
  return (await request(`${COMMUNITY}articles`, { method: 'PUT', body: { id, ...fields }, token })).article
}

export async function deleteArticle(id, token) {
  await request(`${COMMUNITY}articles&id=${encodeURIComponent(id)}`, { method: 'DELETE', token })
}

export async function addArticleComment(articleId, body, token) {
  return (await request(`${COMMUNITY}comments`, { method: 'POST', body: { articleId, body }, token })).comment
}

export async function deleteArticleComment(id, token) {
  await request(`${COMMUNITY}comments&id=${encodeURIComponent(id)}`, { method: 'DELETE', token })
}

// { like?: boolean, rating?: 'valid' | 'bad' | null }. Returns { reaction, counts }.
export function reactToArticle(articleId, { like, rating }, token) {
  return request(`${COMMUNITY}reactions`, { method: 'POST', body: { articleId, like, rating }, token })
}

// { notifications, unread }
export function listNotifications(token) {
  return request(`${COMMUNITY}notifications`, { token })
}

// One notification by id, or all of them when id is null. Returns the new unread count.
export async function markNotificationsRead(id, token) {
  return (await request(`${COMMUNITY}notifications`, { method: 'POST', body: id ? { id } : { all: true }, token })).unread
}
