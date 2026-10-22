import { createHash } from 'node:crypto'
import { badgeById } from '../../shared/badges.js'
import { AVATAR_COLORS, defaultDisplayName, handleProblem, normalizeHandle, PROFILE_LIMITS } from '../../shared/profile.js'
import { computeProgress } from '../../shared/progress.js'

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
  return { value }
}

// A brand-new account (or a dev session with no account row) has nothing stored yet.
const EMPTY = { handle: null, displayName: null, bio: '', avatar: null, featuredBadges: [], isPublic: false, createdAt: null }

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
  }
}

// Progress plus a few counts, from the same lists /api/progress uses.
export async function summarize(store, userId, today) {
  const [cases, challenges, notes, study, trails] = await Promise.all([
    store.listCases(userId),
    store.listChallenges(userId),
    store.listNotes(userId),
    store.listStudyTime(userId),
    store.listTrails(userId),
  ])
  return {
    progress: computeProgress({ cases, challenges, notes, study, today, trails }),
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
export function publicProfile(stored, userId, { progress, counts }) {
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
    badges,
    featuredBadges: stored.featuredBadges.filter((id) => badges.includes(id)),
    memberSince: stored.createdAt,
  }
}
