import { handleProblem, normalizeHandle } from '../shared/profile.js'
import { clientDay, serverDay } from '../server/core/days.js'
import { getUser } from '../server/core/middlewares/auth.js'
import { fail, ok, readJson, requireUser } from '../server/core/http.js'
import { earnedIds, ownProfile, parseProfile, parseSearch, profileCard, publicProfile, SEARCH_MAX, summarize } from '../server/modules/profile/profile.model.js'
import { getStore } from '../server/infra/database/index.js'

const NOT_FOUND = 'No public profile here.'
const SEARCH_RESULTS = 20

// GET ?handle=xyz: anyone can see a public profile. GET with no handle: your own, for the editor.
export async function GET(request) {
  const params = new URL(request.url).searchParams
  const today = clientDay(params.get('today')) ?? serverDay()
  const store = getStore()

  // GET ?search=q: anyone can look for public profiles by handle or name ("Find detectives").
  if (params.has('search')) {
    const query = parseSearch(params.get('search'))
    if (query === null) return fail(400, `Search with letters, numbers, spaces, _ . and -, up to ${SEARCH_MAX} characters.`)
    const found = await store.searchPublicProfiles(query, SEARCH_RESULTS)
    const response = ok({ profiles: found.map(({ userId, profile }) => profileCard(profile, userId)) })
    // Short, and no stale copies: a profile made private should drop out of search quickly.
    response.headers.set('Cache-Control', 'public, s-maxage=15')
    return response
  }

  if (params.has('handle')) {
    const handle = normalizeHandle(params.get('handle'))
    if (handleProblem(handle)) return fail(404, NOT_FOUND)
    const found = await store.findPublicProfile(handle)
    if (!found) {
      // Your own page while it's still private: you see it (marked as a preview), nobody else does.
      const viewer = await getUser(request)
      const own = viewer && (await store.getProfile(viewer.id))
      if (own?.handle !== handle) return fail(404, NOT_FOUND)
      const response = ok({ profile: publicProfile(own, viewer.id, await summarize(store, viewer.id, today)), preview: true })
      response.headers.set('Cache-Control', 'private, no-store')
      return response
    }
    const response = ok({ profile: publicProfile(found.profile, found.userId, await summarize(store, found.userId, today)) })
    // A shared link can get a lot of hits: let the CDN answer repeats for a minute.
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    return response
  }

  const auth = await requireUser(request)
  if (auth.response) return auth.response
  const [stored, { progress }] = await Promise.all([store.getProfile(auth.user.id), summarize(store, auth.user.id, today)])
  const { level, title, xp, levelXp, nextLevelXp } = progress
  return ok({
    profile: ownProfile(stored, auth.user),
    earnedBadges: earnedIds(progress),
    progress: { level, title, xp, levelXp, nextLevelXp },
  })
}

export async function PUT(request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response

  const body = await readJson(request)
  if (!body || Array.isArray(body)) return fail(400, 'Invalid request.')
  const parsed = parseProfile(body)
  if (!parsed.value) return fail(parsed.status, parsed.message)
  // Demo accounts are free and throwaway: they can't squat handles or publish pages.
  if (auth.user.isDemo && (parsed.value.handle || parsed.value.isPublic)) {
    return fail(403, 'Sign up to pick a handle and share your profile.')
  }

  const store = getStore()
  const current = await store.getProfile(auth.user.id)
  if (!current) return fail(404, 'Account not found.')
  const handle = parsed.value.handle !== undefined ? parsed.value.handle : current.handle
  const isPublic = parsed.value.isPublic ?? current.isPublic
  if (isPublic && !handle) return fail(400, 'Pick a handle before making your profile public.')

  const result = await store.updateProfile(auth.user.id, parsed.value)
  if (!result) return fail(404, 'Account not found.')
  if (result.conflict) return fail(409, 'That handle is taken. Try another one.')
  return ok({ profile: ownProfile(result.profile, auth.user) })
}
