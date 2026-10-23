import { useEffect, useSyncExternalStore } from 'react'
import { getMyProfile } from '../api.js'
import { useAuth } from '../auth/auth-provider.jsx'
import { localDay } from '../day.js'

// The signed-in person's profile, shared by the header avatar and the profile page.
// Kept per account for the whole visit, so moving between pages doesn't ask the server again.
const cache = new Map()
const inflight = new Map()
const listeners = new Set()

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify() {
  for (const listener of listeners) listener()
}

// After a save, so the header shows the new avatar right away.
export function rememberMyProfile(userId, data) {
  cache.set(userId, data)
  notify()
}

// Tests start each case with nothing cached.
export function forgetMyProfiles() {
  cache.clear()
  inflight.clear()
  notify()
}

// One request at a time per account. fresh asks the server even when something is cached.
export function loadMyProfile(userId, getToken, { fresh = false } = {}) {
  if (inflight.has(userId)) return inflight.get(userId)
  if (!fresh && cache.has(userId)) return Promise.resolve(cache.get(userId))
  const call = (async () => {
    try {
      const data = await getMyProfile(localDay(), await getToken())
      rememberMyProfile(userId, data)
      return data
    } finally {
      inflight.delete(userId)
    }
  })()
  inflight.set(userId, call)
  return call
}

// { profile, earnedBadges, progress } once loaded, null before (or when it couldn't load).
export function useMyProfile() {
  const { user, getToken } = useAuth()
  const userId = user?.id
  const data = useSyncExternalStore(subscribe, () => (userId ? cache.get(userId) : undefined))

  useEffect(() => {
    if (!userId) return
    // The header avatar is a bonus: if it can't load, a plain tile stays in its place.
    loadMyProfile(userId, getToken).catch(() => {})
  }, [userId, getToken])

  return data ?? null
}
