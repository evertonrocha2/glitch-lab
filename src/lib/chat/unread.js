import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { getUnreadMessages } from '../api.js'
import { useAuth } from '../auth/auth-provider.jsx'

// How many conversations have unread messages, for the "Messages" nav badge. Kept per account for
// the whole visit (every page draws its own header). The message alerts (message-alerts.jsx) keep it
// fresh: a realtime nudge or their poll refetches the inbox and sets it here.
const FRESH_MS = 15_000

const counts = new Map()
const checkedAt = new Map()
const listeners = new Set()

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// The messages page knows the new count right after marking a conversation read.
export function setUnreadMessages(userId, count) {
  counts.set(userId, count)
  for (const listener of listeners) listener()
}

// Tests start each case with nothing cached.
export function forgetUnreadMessages() {
  counts.clear()
  checkedAt.clear()
  for (const listener of listeners) listener()
}

// Just the stored count, without asking the server.
export function useUnreadCount(userId) {
  return useSyncExternalStore(subscribe, () => (userId ? (counts.get(userId) ?? 0) : 0))
}

export function useUnreadMessages() {
  const { user, getToken } = useAuth()
  const userId = user?.id
  // Demo accounts can't have conversations, so they never ask.
  const active = Boolean(userId && !user.isDemo)
  const count = useUnreadCount(userId)

  const refresh = useCallback(async () => {
    if (!active || document.hidden) return
    checkedAt.set(userId, Date.now())
    try {
      setUnreadMessages(userId, await getUnreadMessages(await getToken()))
    } catch {
      // The badge is a bonus: if it can't load, it stays as it was.
    }
  }, [active, userId, getToken])

  useEffect(() => {
    if (active && Date.now() - (checkedAt.get(userId) ?? 0) > FRESH_MS) refresh()
  }, [active, userId, refresh])

  return count
}
