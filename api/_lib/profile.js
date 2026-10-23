import { createHash } from 'node:crypto'
import { badgeById } from '../../shared/badges.js'
import {
  AVATAR_COLORS,
  defaultDisplayName,
  handleProblem,
  LANGUAGES,
  LINKS,
  linkProblem,
  normalizeHandle,
  OPEN_TO,
  PROFILE_LIMITS,
  ROLES,
} from '../../shared/profile.js'
import { activityCalendar } from '../../shared/activity.js'
import { computeProgress } from '../../shared/progress.js'
import { loadDaily } from './puzzles/solved.js'
import { loadRiddle } from './riddle/solved.js'

const INVALID = { status: 400, message: 'Invalid request.' }
const tooLong = (what, max) => ({ status: 413, message: `Too long. Keep your ${what} under ${max + 1} characters.` })
const isText = (value) => typeof value === 'string'
// No control characters (tabs, escapes and the like); the bio may still have line breaks.
const CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f]/

function parseAvatar(avatar) {
  if (!avatar || typeof avatar !== 'object' || !isText(avatar.seed) || !isText(avatar.color)) return null
  const seed = avatar.seed.trim()
  if (!seed || seed.length > PROFILE_LIMITS.seed || CONTROL.test(seed)) return null
  if (!AVATAR_COLORS.some((color) => color.id === avatar.color)) return null
  return { seed, color: avatar.color }
}

// { value } with only the fields sent, cleaned up, or { status, message }.
// A blank display name becomes null, which means "use the default".
export function parseProfile(body) {
  const value = {}
  if (body.handle !== undefined) {
    if (body.handle === null) value.handle = null
    else {
      if (!isText(body.handle)) return INVALID
      const handle = normalizeHandle(body.handle)
      const problem = handleProblem(handle)
      if (problem) return { status: 400, message: `That handle won't work. ${problem}` }
      value.handle = handle
    }
  }
  if (body.displayName !== undefined) {
    if (!isText(body.displayName) || CONTROL.test(body.displayName)) return INVALID
    const name = body.displayName.trim()
    if (name.length > PROFILE_LIMITS.displayName) return tooLong('name', PROFILE_LIMITS.displayName)
    value.displayName = name || null
  }
  if (body.bio !== undefined) {
    if (!isText(body.bio) || CONTROL.test(body.bio)) return INVALID
    const bio = body.bio.trim()
    if (bio.length > PROFILE_LIMITS.bio) return tooLong('bio', PROFILE_LIMITS.bio)
    value.bio = bio
  }
  if (body.avatar !== undefined) {
    value.avatar = parseAvatar(body.avatar)
    if (!value.avatar) return INVALID
  }
  if (body.featuredBadges !== undefined) {
    if (!Array.isArray(body.featuredBadges) || !body.featuredBadges.every((id) => isText(id) && badgeById(id))) return INVALID
    const featured = [...new Set(body.featuredBadges)]
    if (featured.length > PROFILE_LIMITS.featured) return { status: 400, message: `Pick up to ${PROFILE_LIMITS.featured} badges.` }
    value.featuredBadges = featured
  }
  if (body.isPublic !== undefined) {
    if (typeof body.isPublic !== 'boolean') return INVALID
    value.isPublic = body.isPublic
  }
  const aboutProblem = parseAbout(body, value)
  return aboutProblem ?? { value }
}

// One line of text: no line breaks or control characters. Blank means "not filled in".
const ONE_LINE = /[\u0000-\u001f\u007f]/
const ABOUT_TEXT = [
  ['headline', 'headline'],
  ['university', 'university'],
  ['course', 'course'],
  ['work', 'job'],
  ['location', 'location'],
]

// A list of ids from a fixed set, without repeats. null when anything in it is unknown.
function pickIds(list, allowed) {
  if (!Array.isArray(list) || !list.every((id) => isText(id) && allowed.some((item) => item.id === id))) return null
  return [...new Set(list)]
}

// Fills the "About you" fields into value. Returns { status, message } on the first problem, else null.
function parseAbout(body, value) {
  if (body.role !== undefined) {
    if (body.role !== null && !ROLES.some((role) => role.id === body.role)) return INVALID
    value.role = body.role
  }
  for (const [field, what] of ABOUT_TEXT) {
    if (body[field] === undefined) continue
    if (!isText(body[field]) || ONE_LINE.test(body[field])) return INVALID
    const text = body[field].trim()
    if (text.length > PROFILE_LIMITS[field]) return tooLong(what, PROFILE_LIMITS[field])
    value[field] = text
  }
  if (body.languages !== undefined) {
    const languages = pickIds(body.languages, LANGUAGES)
    if (!languages) return INVALID
    if (languages.length > PROFILE_LIMITS.languages) return { status: 400, message: `Pick up to ${PROFILE_LIMITS.languages} languages.` }
    value.languages = languages
  }
  if (body.openTo !== undefined) {
    value.openTo = pickIds(body.openTo, OPEN_TO)
    if (!value.openTo) return INVALID
  }
  if (body.links !== undefined) {
    const { links } = body
    if (!links || typeof links !== 'object' || Array.isArray(links)) return INVALID
    value.links = {}
    for (const [kind, raw] of Object.entries(links)) {
      const link = LINKS.find((item) => item.id === kind)
      if (!link || !isText(raw)) return INVALID
      const url = raw.trim()
      if (!url) continue
      const problem = linkProblem(kind, url)
      if (problem) return { status: 400, message: `That ${link.label} link won't work. ${problem}` }
      value.links[kind] = new URL(url).href
    }
  }
  return null
}

// "About you" before anything is filled in.
const EMPTY_ABOUT = { role: null, headline: '', university: '', course: '', work: '', location: '', languages: [], links: {}, openTo: [] }
const aboutOf = (profile) => ({
  role: profile.role ?? null,
  headline: profile.headline ?? '',
  university: profile.university ?? '',
  course: profile.course ?? '',
  work: profile.work ?? '',
  location: profile.location ?? '',
  languages: profile.languages ?? [],
  links: profile.links ?? {},
  openTo: profile.openTo ?? [],
})

// A brand-new account (or a dev session with no account row) has nothing stored yet.
const EMPTY = { handle: null, displayName: null, bio: '', avatar: null, featuredBadges: [], isPublic: false, ...EMPTY_ABOUT, createdAt: null }

// The default picture comes from the user id, hashed so a public profile never shows the id itself.
export const defaultSeed = (userId) => createHash('sha256').update(userId).digest('hex').slice(0, 12)
const avatarOf = (stored, userId) => stored.avatar ?? { seed: defaultSeed(userId), color: AVATAR_COLORS[0].id }

// What the editor shows: stored fields with the defaults filled in. No email.
// The name stays null until the person types one: the email-based suggestion is only a placeholder,
// so saving other fields can never publish part of an email address.
export function ownProfile(stored, user) {
  const profile = stored ?? EMPTY
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    suggestedName: defaultDisplayName(user),
    bio: profile.bio,
    avatar: avatarOf(profile, user.id),
    featuredBadges: profile.featuredBadges,
    isPublic: profile.isPublic,
    ...aboutOf(profile),
  }
}

// Progress plus a few counts, from the same lists /api/progress uses.
export async function summarize(store, userId, today) {
  const [cases, challenges, notes, study, trails, community] = await Promise.all([
    store.listCases(userId),
    store.listChallenges(userId),
    store.listNotes(userId),
    store.listStudyTime(userId),
    store.listTrails(userId),
    store.communityStats(userId),
  ])
  const [daily, riddle] = await Promise.all([loadDaily(store, userId, challenges), loadRiddle(store, userId)])
  // Community events: entries sent, places won, votes received, events hosted.
  const events = await store.eventStats(userId)
  return {
    progress: computeProgress({ cases, challenges, notes, study, today, trails, daily, community, riddle, events }),
    // Only a count per day: what was done stays private, that something was done is shown.
    activity: activityCalendar({ cases, challenges, notes, study, riddle, events }, today),
    counts: {
      cases: cases.length,
      solved: cases.filter((item) => item.status === 'solved').length,
      passedChallenges: challenges.filter((item) => item.status === 'passed').length,
    },
  }
}

export const earnedIds = (progress) => progress.badges.filter((badge) => badge.earned).map((badge) => badge.id)

// The only things a visitor ever sees. Built field by field so nothing private slips in:
// no email, no ids, no case, note or challenge contents. Without a chosen name, the handle
// stands in (the email-based default would leak part of the email).
export function publicProfile(stored, userId, { progress, counts, activity }) {
  const badges = earnedIds(progress)
  return {
    handle: stored.handle,
    displayName: stored.displayName ?? stored.handle,
    bio: stored.bio,
    avatar: avatarOf(stored, userId),
    level: progress.level,
    title: progress.title,
    xp: progress.xp,
    levelXp: progress.levelXp,
    nextLevelXp: progress.nextLevelXp,
    streak: progress.streak,
    totalSeconds: progress.totalSeconds,
    counts,
    activity,
    badges,
    featuredBadges: stored.featuredBadges.filter((id) => badges.includes(id)),
    memberSince: stored.createdAt,
    ...aboutOf(stored),
  }
}

// A small card for search results and note bylines: who they are, no stats (those cost a lookup each).
export function profileCard(stored, userId) {
  const { role, headline, university, work, location, languages } = aboutOf(stored)
  return {
    handle: stored.handle,
    displayName: stored.displayName ?? stored.handle,
    avatar: avatarOf(stored, userId),
    role,
    headline,
    university,
    work,
    location,
    languages,
  }
}

// What a search may hold: letters, numbers, spaces and _ . -, up to 40 characters.
// null for anything else, so no wildcard or filter syntax ever reaches the store.
export const SEARCH_MAX = 40
export function parseSearch(raw) {
  // Handles are shown as @handle everywhere, so people type the @ too.
  const query = raw.trim().replace(/^@+/, '')
  if (query.length > SEARCH_MAX || !/^[\p{L}\p{N} _.-]*$/u.test(query)) return null
  return query
}
