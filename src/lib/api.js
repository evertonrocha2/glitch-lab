import { currentLocale, translate } from './i18n/I18nProvider.jsx'
import { translateServerMessage } from './i18n/serverMessages.js'

// Every error a page shows reads in the reader's language: the server's English messages are
// translated here, and so are the client's own fallbacks.
const genericMessage = () => translate(currentLocale(), 'server.client.generic')
const offlineMessage = () => translate(currentLocale(), 'server.client.offline')
const serverMessage = (data, fallback) => (data?.message ? translateServerMessage(data.message, currentLocale()) : fallback())

// Thrown on 401 so pages can send the person back to the login screen.
export class AuthError extends Error {}

async function request(path, { method = 'GET', body, token, keepalive } = {}) {
  // The server answers (and asks the AI to write) in the reader's language.
  const headers = { 'Accept-Language': currentLocale() }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(path, { method, headers, keepalive, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new Error(offlineMessage())
  }

  const data = await res.json().catch(() => null)
  if (res.status === 401) throw new AuthError(serverMessage(data, () => translate(currentLocale(), 'server.signIn')))
  if (!res.ok || !data) throw new Error(serverMessage(data, genericMessage))
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

// Daily challenges: { day, nextResetAt, streak, puzzles: [card with status, challengeId, attempts] }.
export function getDaily(token) {
  return request('/api/challenge?daily=1', { token })
}

// This week's global challenge: { week, endsAt, puzzle, solvedCount, leaderboard, you }.
export function getGlobalChallenge(token) {
  return request('/api/challenge?global=1', { token })
}

// Starts a daily or global puzzle (or resumes it) and returns its gym challenge.
export async function startPuzzle(puzzleId, token) {
  return (await request('/api/challenge', { method: 'POST', body: { daily: true, puzzleId }, token })).challenge
}

// Today's Glitchdle: { day, number, nextResetAt, modes: { classic, error, snippet }, stats, community }.
export function getRiddle(token) {
  return request('/api/challenge?riddle=1', { token })
}

// One Glitchdle guess (a language id). Answers with the same shape as getRiddle plus { correct }.
export function guessRiddle({ mode, guess, day }, token) {
  return request('/api/challenge', { method: 'POST', body: { riddle: true, mode, guess, day }, token })
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
// { profile, preview } or null. With your token, your own private profile comes back as a preview.
export async function getPublicProfile(handle, today, token) {
  const path = `/api/profile?handle=${encodeURIComponent(handle)}&today=${encodeURIComponent(today)}`
  let res
  try {
    const headers = { 'Accept-Language': currentLocale() }
    if (token) headers.Authorization = `Bearer ${token}`
    res = await fetch(path, { method: 'GET', headers })
  } catch {
    throw new Error(offlineMessage())
  }
  if (res.status === 404) return null
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) throw new Error(serverMessage(data, genericMessage))
  return { profile: data.profile, preview: Boolean(data.preview) }
}

// Public pages (notes on a profile, people search) work signed out: no token, and 404 means "not shared".
async function publicGet(path) {
  let res
  try {
    res = await fetch(path, { method: 'GET', headers: { 'Accept-Language': currentLocale() } })
  } catch {
    throw new Error(offlineMessage())
  }
  if (res.status === 404) return null
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) throw new Error(serverMessage(data, genericMessage))
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
