import { createSseParser } from '../../shared/sse.js'
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
  return request('/api/auth/login', { method: 'POST', body: { email, password } })
}

export function signUp({ email, password }) {
  return request('/api/auth/register', { method: 'POST', body: { email, password } })
}

// today: the visitor's date, so the sample study streak matches their clock.
export function startDemo(today) {
  return request('/api/auth/demo', { method: 'POST', body: { today } })
}

// files and context are optional extras from the form.
export async function analyzeError({ error, code, context, files }, token) {
  return (await request('/api/cases/analyze', { method: 'POST', body: { error, code, context, files }, token })).case
}

export async function listCases(token) {
  return (await request('/api/cases', { token })).cases
}

export async function startChallenge(caseId, token) {
  return (await request('/api/challenges', { method: 'POST', body: { caseId }, token })).challenge
}

export async function getChallenge(id, token) {
  return (await request(`/api/challenges/${encodeURIComponent(id)}`, { token })).challenge
}

// { hint, hintsRevealed }
export function revealHint(challengeId, token) {
  return request(`/api/challenges/${encodeURIComponent(challengeId)}/hints`, { method: 'POST', token })
}

// { passed, feedback, case }
export function checkFix(challengeId, code, token) {
  return request(`/api/challenges/${encodeURIComponent(challengeId)}/check`, { method: 'POST', body: { code }, token })
}

// Interrogation (guided debugging on a case): { case, interrogation }.
export function getInterrogation(caseId, token) {
  return request(`/api/cases/${encodeURIComponent(caseId)}/interrogation`, { token })
}

// One answer for the current step: { interrogation, turn, finished, xp }.
export function answerInterrogation({ caseId, answer }, token) {
  return request(`/api/cases/${encodeURIComponent(caseId)}/interrogation/answers`, { method: 'POST', body: { answer }, token })
}

// Daily challenges: { day, nextResetAt, streak, puzzles: [card with status, challengeId, attempts] }.
export function getDaily(token) {
  return request('/api/daily', { token })
}

// This week's global challenge: { week, endsAt, puzzle, solvedCount, leaderboard, you }.
export function getGlobalChallenge(token) {
  return request('/api/daily/weekly', { token })
}

// Starts a daily or global puzzle (or resumes it) and returns its gym challenge.
export async function startPuzzle(puzzleId, token) {
  return (await request(`/api/daily/puzzles/${encodeURIComponent(puzzleId)}/challenge`, { method: 'POST', token })).challenge
}

// Today's Glitchdle: { day, number, nextResetAt, modes: { classic, error, snippet }, stats, community }.
export function getRiddle(token) {
  return request('/api/glitchdle', { token })
}

// One Glitchdle guess (a language id). Answers with the same shape as getRiddle plus { correct }.
export function guessRiddle({ mode, guess, day }, token) {
  return request('/api/glitchdle/guesses', { method: 'POST', body: { mode, guess, day }, token })
}

// Line hunt: today's run (where I am in it) and its leaderboard.
export function getHunt(token) {
  return request('/api/hunt', { token })
}

// Line hunt actions: 'start', 'answer' ({ index, line, day }), 'next' ({ day }) and 'practice'
// ({ id, line }). Each answers with the run's new state; an answer also carries { result }.
const HUNT_PATHS = { start: '/api/hunt/start', answer: '/api/hunt/answers', next: '/api/hunt/next', practice: '/api/hunt/practice/answers' }

export function sendHunt(action, fields, token) {
  return request(HUNT_PATHS[action] ?? `/api/hunt/${encodeURIComponent(action)}`, { method: 'POST', body: { ...fields }, token })
}

// One practice snippet ({ roundMs, snippet }), never the one just played (`after`).
export function getPracticeSnippet(after, token) {
  return request(`/api/hunt/practice${after ? `?after=${encodeURIComponent(after)}` : ''}`, { token })
}

// Duel lobby: { rating, recent, leaderboard, active, isDemo }.
export function getDuelLobby(token) {
  return request('/api/duels', { token })
}

// One duel as I see it right now, with the server's clock in `now`.
export async function getDuel(id, token) {
  return (await request(`/api/duels/${encodeURIComponent(id)}`, { token })).duel
}

// A duel move: 'create' | 'join' | 'queue' | 'bot' | 'answer' | 'focus' | 'leave' | 'rematch'.
// Answers with { duel } ('focus' with { recorded }). keepalive lets a tab-leave report out as the tab hides.
// Moves on one duel go to its own path; create, queue, bot and join-by-code don't have one yet.
const DUEL_MOVES = { answer: 'answers', focus: 'focus', leave: 'leave', rematch: 'rematch', join: 'join' }

function duelPath(action, id) {
  if (action === 'create') return '/api/duels'
  if (id && DUEL_MOVES[action]) return `/api/duels/${encodeURIComponent(id)}/${DUEL_MOVES[action]}`
  return `/api/duels/${encodeURIComponent(action)}`
}

export function sendDuel(action, fields = {}, token, { keepalive = false } = {}) {
  const { id, ...rest } = fields
  return request(duelPath(action, id), { method: 'POST', body: rest, token, keepalive })
}

export async function listNotes(token) {
  return (await request('/api/notes', { token })).notes
}

export async function createNote({ title, blocks }, token) {
  return (await request('/api/notes', { method: 'POST', body: { title, blocks }, token })).note
}

export async function updateNote(id, { title, blocks }, token, { keepalive = false } = {}) {
  return (await request(`/api/notes/${encodeURIComponent(id)}`, { method: 'PATCH', body: { title, blocks }, token, keepalive })).note
}

export async function deleteNote(id, token) {
  await request(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE', token })
}

// keepalive lets the last report go out while the tab is closing. Returns today's total in seconds.
export async function addStudyTime({ seconds, day }, token, { keepalive = false } = {}) {
  return (await request('/api/progress/study-time', { method: 'POST', body: { seconds, day }, token, keepalive })).todaySeconds
}

export async function getProgress(today, token) {
  return (await request(`/api/progress?today=${encodeURIComponent(today)}`, { token })).progress
}

// The study trail page: { trail (or null), history, sources: { cases, notes } }.
export function getTrail(token) {
  return request('/api/trails', { token })
}

// Asks the AI for a new trail (slow: the free AI can take a minute). Same shape as getTrail.
export function buildTrail(today, token) {
  return request('/api/trails', { method: 'POST', body: { today }, token })
}

// Ticks or unticks a reflect mission; returns the updated trail.
export async function setTrailMission({ trailId, missionId, done }, token) {
  return (await request(`/api/trails/${encodeURIComponent(trailId)}/missions/${encodeURIComponent(missionId)}`, { method: 'PATCH', body: { done }, token })).trail
}

// The Lab assistant: { reply, parts, actions, agents, steps }.
export function askAssistant({ messages, page }, token) {
  return request('/api/assistant', { method: 'POST', body: { messages, page }, token })
}

// The streamed answers go through the same /api as everything else, unless VITE_API_STREAM_URL
// points them straight at the API (for a proxy that would hold the stream back).
const STREAM_BASE = (import.meta.env?.VITE_API_STREAM_URL ?? '').replace(/\/$/, '')
export const ASSISTANT_STREAM_URL = `${STREAM_BASE}/api/assistant/stream`
export const QUESTION_STREAM_URL = `${STREAM_BASE}/api/questions/stream`

// The stream could not be used at all (blocked, buffered into something else, cut before any text):
// the caller asks askAssistant instead.
export class StreamUnavailableError extends Error {}

// POSTs `body` to a Server-Sent Events endpoint and reads it. fetch and a reader, since EventSource
// can't POST or send the Authorization header. onEvent({ type, data }) gets each event but `done`
// and `error` as it comes; resolves with the `done` payload, or throws: the translated `error`
// message, AuthError, the abort when `signal` fires, or StreamUnavailableError.
async function streamEvents(url, body, token, { onEvent, signal } = {}) {
  const headers = { Accept: 'text/event-stream', 'Accept-Language': currentLocale(), 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new StreamUnavailableError(offlineMessage())
  }

  if (!(res.headers.get('content-type') ?? '').startsWith('text/event-stream') || !res.body) {
    const data = await res.json().catch(() => null)
    if (res.status === 401) throw new AuthError(serverMessage(data, () => translate(currentLocale(), 'server.signIn')))
    // The API's own answer (a bad request, the daily limit): asking again the other way won't help.
    if (!res.ok && data?.message) throw new Error(serverMessage(data, genericMessage))
    throw new StreamUnavailableError(genericMessage())
  }

  let result = null
  let failure = null
  let wrote = false
  const parser = createSseParser(({ event, data }) => {
    let payload
    try {
      payload = JSON.parse(data)
    } catch {
      return
    }
    if (event === 'done') result = payload
    else if (event === 'error') failure = payload
    else {
      if (event === 'delta') wrote = true
      onEvent?.({ type: event, data: payload })
    }
  })

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parser.push(decoder.decode(value, { stream: true }))
    }
    parser.push(decoder.decode())
    parser.end()
  } catch (err) {
    if (signal?.aborted) throw err
    if (!wrote) throw new StreamUnavailableError(genericMessage())
    throw new Error(genericMessage())
  }

  if (result) return result
  if (failure) throw new Error(serverMessage(failure, genericMessage))
  if (!wrote) throw new StreamUnavailableError(genericMessage())
  throw new Error(genericMessage())
}

// The Lab assistant, streamed: `step` and `delta` events, then the same payload as askAssistant's.
export function streamAssistant({ messages, page }, token, options) {
  return streamEvents(ASSISTANT_STREAM_URL, { messages, page }, token, options)
}

// One tutor turn of a doubt chat, streamed: `delta` events ({ text }) as it writes, then
// { reply, card, turns, turnsLeft }. messages: [{ role, content, code?, cardTopic? }], the
// student's doubt first and their new question last.
export function streamQuestion({ messages }, token, options) {
  return streamEvents(QUESTION_STREAM_URL, { messages }, token, options)
}

// A board card from a doubt chat and the card the tutor proposed: the new (or same) question case.
export async function createCaseFromQuestion({ messages, card }, token) {
  return (await request('/api/cases/from-question', { method: 'POST', body: { messages, card }, token })).case
}

// { profile, earnedBadges, progress } for the profile editor.
export function getMyProfile(today, token) {
  return request(`/api/me?today=${encodeURIComponent(today)}`, { token })
}

// Sends only the fields that changed; returns the saved profile.
export async function saveProfile(patch, token) {
  return (await request('/api/me', { method: 'PATCH', body: patch, token })).profile
}

// Anyone can look, signed in or not. null when the handle has no public profile (missing or private).
// { profile, preview } or null. With your token, your own private profile comes back as a preview.
export async function getPublicProfile(handle, today, token) {
  const path = `/api/profiles/${encodeURIComponent(handle)}?today=${encodeURIComponent(today)}`
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
  return (await request(`/api/notes/${encodeURIComponent(id)}`, { method: 'PATCH', body: { isPublic }, token })).note
}

// [{ id, title, updatedAt, excerpt, blockCount }], or null when the profile isn't public.
export async function listPublicNotes(handle) {
  return (await publicGet(`/api/profiles/${encodeURIComponent(handle)}/notes`))?.notes ?? null
}

// { note, author } for one shared note, or null when it isn't shared.
export function getPublicNote(handle, id) {
  return publicGet(`/api/profiles/${encodeURIComponent(handle)}/notes/${encodeURIComponent(id)}`)
}

// Up to 20 public profile cards whose handle or name matches. An empty query lists the newest.
export async function searchProfiles(query) {
  return (await publicGet(`/api/profiles?search=${encodeURIComponent(query)}`))?.profiles ?? []
}

// Only the filters that are set go in the query string.
function withQuery(path, filters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

const at = (path, id) => `${path}/${encodeURIComponent(id)}`

// Community articles. Reading works signed out (token may be null); everything else needs a token.

// { articles, page, hasMore }.
export function listArticles({ q, tag, author, sort, page } = {}, token) {
  return request(withQuery('/api/articles', { q, tag, author, sort, page }), { token })
}

// { article, comments, reaction } (reaction is null when signed out).
export function getArticle(id, token) {
  return request(at('/api/articles', id), { token })
}

export async function createArticle({ title, body, tags, caseId }, token) {
  return (await request('/api/articles', { method: 'POST', body: { title, body, tags, caseId }, token })).article
}

export async function updateArticle(id, fields, token) {
  return (await request(at('/api/articles', id), { method: 'PATCH', body: fields, token })).article
}

export async function deleteArticle(id, token) {
  await request(at('/api/articles', id), { method: 'DELETE', token })
}

export async function addArticleComment(articleId, body, token) {
  return (await request(`${at('/api/articles', articleId)}/comments`, { method: 'POST', body: { body }, token })).comment
}

export async function deleteArticleComment(id, token) {
  await request(at('/api/comments', id), { method: 'DELETE', token })
}

// { like?: boolean, rating?: 'valid' | 'bad' | null }. Returns { reaction, counts }.
export function reactToArticle(articleId, { like, rating }, token) {
  return request(`${at('/api/articles', articleId)}/reactions`, { method: 'POST', body: { like, rating }, token })
}

// { notifications, unread }
export function listNotifications(token) {
  return request('/api/notifications', { token })
}

// One notification by id, or all of them when id is null. Returns the new unread count.
export async function markNotificationsRead(id, token) {
  return (await request('/api/notifications/read', { method: 'POST', body: id ? { id } : { all: true }, token })).unread
}

// Community events. Reading works signed out (token may be null); everything else needs a token.
// { events, page, hasMore } for a tab (live, upcoming, ended).
export function listEvents({ q, tab, page } = {}, token) {
  return request(withQuery('/api/events', { q, tab, page }), { token })
}

// { event, entries (ranked by votes), myEntry, myVotes }. createEvent and the organizer tools answer the same.
export function getEvent(id, token) {
  return request(at('/api/events', id), { token })
}

export function createEvent(fields, token) {
  return request('/api/events', { method: 'POST', body: fields, token })
}

export function updateEvent(id, fields, token) {
  return request(at('/api/events', id), { method: 'PATCH', body: fields, token })
}

export function closeEvent(id, token) {
  return request(`${at('/api/events', id)}/close`, { method: 'POST', token })
}

// winners: entry ids, first place first (1 to 3).
export function pickWinners(id, winners, token) {
  return request(`${at('/api/events', id)}/winners`, { method: 'POST', body: { winners }, token })
}

export async function submitEntry(eventId, fields, token) {
  return (await request(`${at('/api/events', eventId)}/entries`, { method: 'POST', body: fields, token })).entry
}

export async function updateEntry(id, fields, token) {
  return (await request(at('/api/entries', id), { method: 'PATCH', body: fields, token })).entry
}

// Returns { voted, votes }.
export function voteEntry(entryId, vote, token) {
  return request(`${at('/api/entries', entryId)}/votes`, { method: 'POST', body: { vote }, token })
}

// Spaced review: { today, met, due: [{ concept, box }], nextDueDay, session, day, xpCap }.
export async function getReview(today, token) {
  return (await request(`/api/review?today=${encodeURIComponent(today)}`, { token })).review
}

// Opens today's review session (or resumes the open one): { id, cards, answers, right, done }.
export async function startReview(today, token) {
  return (await request('/api/review/sessions', { method: 'POST', body: { today }, token })).session
}

// Grades one card: { result, item, xp, session, day }.
export function answerReview({ sessionId, index, choice, today }, token) {
  return request('/api/review/answers', { method: 'POST', body: { sessionId, index, choice, today }, token })
}

// Direct messages. { conversations, unread } (unread: conversations with news).
export function listConversations(token) {
  return request('/api/conversations', { token })
}

// How many conversations have unread messages, for the nav badge.
export async function getUnreadMessages(token) {
  return (await request('/api/conversations/unread', { token })).unread
}

// Opens (or reopens) my conversation with a public profile: { id, other, blocked, canSend, reason }.
export async function startConversation(handle, token) {
  return (await request('/api/conversations', { method: 'POST', body: { handle }, token })).conversation
}

// { conversation, messages (oldest first), hasMore }. before: an older page; after: what's new.
export function getConversationMessages(id, { before, after } = {}, token) {
  return request(withQuery(`${at('/api/conversations', id)}/messages`, { before, after }), { token })
}

export async function sendConversationMessage(id, body, token) {
  return (await request(`${at('/api/conversations', id)}/messages`, { method: 'POST', body: { body }, token })).message
}

// Returns how many conversations are still unread.
export async function markConversationRead(id, token) {
  return (await request(`${at('/api/conversations', id)}/read`, { method: 'POST', token })).unread
}

// For the "Send message" button: { canMessage, reason, blocked, conversationId }.
export function getMessagingWith(handle, token) {
  return request(at('/api/messaging/with', handle), { token })
}

// "Who can message me": 'everyone' or 'nobody'.
export async function getMessageSettings(token) {
  return (await request('/api/messaging/settings', { token })).allowMessages
}

export async function saveMessageSettings(allowMessages, token) {
  return (await request('/api/messaging/settings', { method: 'PATCH', body: { allowMessages }, token })).allowMessages
}

// target: { handle } or { conversationId }.
export function blockPerson(target, token) {
  return request('/api/blocks', { method: 'POST', body: target, token })
}

export function unblockPerson(target, token) {
  return request('/api/blocks', { method: 'DELETE', body: target, token })
}

// { kind: 'dm' | 'community', messageId, reason, note }
export function reportMessage(fields, token) {
  return request('/api/reports', { method: 'POST', body: fields, token })
}

// Communities. Reading works signed out (token may be null). { communities, page, hasMore, mine }.
export function listCommunities({ q, topic, page } = {}, token) {
  return request(withQuery('/api/communities', { q, topic, page }), { token })
}

export async function createCommunity(fields, token) {
  return (await request('/api/communities', { method: 'POST', body: fields, token })).community
}

// { community, membership, canPost, members }. Joining and leaving answer the same.
export function getCommunity(slug, token) {
  return request(at('/api/communities', slug), { token })
}

export function joinCommunity(slug, token) {
  return request(`${at('/api/communities', slug)}/join`, { method: 'POST', token })
}

export function leaveCommunity(slug, token) {
  return request(`${at('/api/communities', slug)}/leave`, { method: 'POST', token })
}

// { messages (oldest first), hasMore }, like a conversation.
export function getCommunityMessages(slug, { before, after } = {}, token) {
  return request(withQuery(`${at('/api/communities', slug)}/messages`, { before, after }), { token })
}

export async function postCommunityMessage(slug, body, token) {
  return (await request(`${at('/api/communities', slug)}/messages`, { method: 'POST', body: { body }, token })).message
}

export async function deleteCommunityMessage(id, token) {
  await request(at('/api/community-messages', id), { method: 'DELETE', token })
}

export async function removeCommunityMember(slug, userId, token) {
  await request(`${at('/api/communities', slug)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE', token })
}
