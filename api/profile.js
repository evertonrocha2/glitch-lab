import { handleProblem, normalizeHandle } from '../shared/profile.js'
import { clientDay, serverDay } from './_lib/days.js'
import { fail, ok, readJson, requireUser } from './_lib/http.js'
import { earnedIds, ownProfile, parseProfile, publicProfile, summarize } from './_lib/profile.js'
import { getStore } from './_lib/store/index.js'

const NOT_FOUND = 'No public profile here.'

// GET ?handle=xyz: anyone can see a public profile. GET with no handle: your own, for the editor.
export async function GET(request) {
  const params = new URL(request.url).searchParams
  const today = clientDay(params.get('today')) ?? serverDay()
  const store = getStore()

  if (params.has('handle')) {
    const handle = normalizeHandle(params.get('handle'))
    if (handleProblem(handle)) return fail(404, NOT_FOUND)
    const found = await store.findPublicProfile(handle)
    if (!found) return fail(404, NOT_FOUND)
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
