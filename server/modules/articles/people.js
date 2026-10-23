import { AVATAR_COLORS } from '../../../shared/profile.js'
import { defaultSeed } from '../profile/profile.model.js'

// How a person shows up next to their articles, comments and in notifications: never an id or email.
// Without a chosen name the handle stands in, then "Player". Only public profiles get a link.
export function personView(profile, userId) {
  return {
    handle: profile?.handle ?? null,
    name: profile?.displayName ?? profile?.handle ?? 'Player',
    avatar: profile?.avatar ?? { seed: defaultSeed(userId), color: AVATAR_COLORS[0].id },
    isPublic: Boolean(profile?.isPublic && profile.handle),
  }
}

// { [userId]: personView } for everyone in the list, in one store call.
export async function loadPeople(store, userIds) {
  const unique = [...new Set(userIds)]
  const profiles = await store.getProfiles(unique)
  return Object.fromEntries(unique.map((id) => [id, personView(profiles[id], id)]))
}
