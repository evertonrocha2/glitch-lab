import { clientDay, serverDay } from '../../core/days.js'
import { queryText } from '../../core/validation.js'
import * as profiles from './profile.service.js'

const todayOf = (req) => clientDay(queryText(req, 'today')) ?? serverDay()

export async function search(req, res) {
  const found = await profiles.searchProfiles(req.deps.store, queryText(req, 'search') ?? '')
  // Short, and no stale copies: a profile made private should drop out of search quickly.
  res.set('Cache-Control', 'public, s-maxage=15').json({ profiles: found })
}

export async function getPublic(req, res) {
  const { profile, preview } = await profiles.getPublicProfile(req.deps.store, req.params.handle, req.user, todayOf(req))
  if (preview) return res.set('Cache-Control', 'private, no-store').json({ profile, preview })
  // A shared link can get a lot of hits: let the CDN answer repeats for a minute.
  res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300').json({ profile })
}

export async function getOwn(req, res) {
  res.json(await profiles.getOwnProfile(req.deps.store, req.user, todayOf(req)))
}

export async function update(req, res) {
  res.json({ profile: await profiles.updateProfile(req.deps.store, req.user, req.body) })
}
