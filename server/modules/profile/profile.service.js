import { handleProblem, normalizeHandle } from '../../../shared/profile.js'
import { badRequest, conflict, forbidden, notFound, valueOrThrow } from '../../core/errors.js'
import { earnedIds, ownProfile, parseProfile, parseSearch, profileCard, publicProfile, SEARCH_MAX, summarize } from './profile.model.js'

const NOT_FOUND = 'No public profile here.'
const SEARCH_RESULTS = 20

// "Find people": public profiles whose handle or name matches. An empty query lists the newest.
export async function searchProfiles(store, rawQuery) {
  const query = parseSearch(rawQuery)
  if (query === null) throw badRequest(`Search with letters, numbers, spaces, _ . and -, up to ${SEARCH_MAX} characters.`)
  const found = await store.searchPublicProfiles(query, SEARCH_RESULTS)
  return found.map(({ userId, profile }) => profileCard(profile, userId))
}

// { profile, preview }: a public profile anyone can see, or your own while it's still private
// (marked as a preview, and nobody else sees it).
export async function getPublicProfile(store, rawHandle, viewer, today) {
  const handle = normalizeHandle(rawHandle)
  if (handleProblem(handle)) throw notFound(NOT_FOUND)
  const found = await store.findPublicProfile(handle)
  if (found) return { profile: publicProfile(found.profile, found.userId, await summarize(store, found.userId, today)), preview: false }

  const own = viewer && (await store.getProfile(viewer.id))
  if (own?.handle !== handle) throw notFound(NOT_FOUND)
  return { profile: publicProfile(own, viewer.id, await summarize(store, viewer.id, today)), preview: true }
}

// My profile for the editor, with the badges and level it shows.
export async function getOwnProfile(store, user, today) {
  const [stored, { progress }] = await Promise.all([store.getProfile(user.id), summarize(store, user.id, today)])
  const { level, title, xp, levelXp, nextLevelXp } = progress
  return {
    profile: ownProfile(stored, user),
    earnedBadges: earnedIds(progress),
    progress: { level, title, xp, levelXp, nextLevelXp },
  }
}

// Saves only the fields sent.
export async function updateProfile(store, user, body) {
  if (!body || Array.isArray(body)) throw badRequest()
  const value = valueOrThrow(parseProfile(body))
  // Demo accounts are free and throwaway: they can't squat handles or publish pages.
  if (user.isDemo && (value.handle || value.isPublic)) throw forbidden('Sign up to pick a handle and share your profile.')

  const current = await store.getProfile(user.id)
  if (!current) throw notFound('Account not found.')
  const handle = value.handle !== undefined ? value.handle : current.handle
  const isPublic = value.isPublic ?? current.isPublic
  if (isPublic && !handle) throw badRequest('Pick a handle before making your profile public.')

  const result = await store.updateProfile(user.id, value)
  if (!result) throw notFound('Account not found.')
  if (result.conflict) throw conflict('That handle is taken. Try another one.')
  return ownProfile(result.profile, user)
}
