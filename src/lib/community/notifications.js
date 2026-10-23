import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { listNotifications, markNotificationsRead } from '../api.js'
import { useAuth } from '../auth/auth-provider.jsx'

// The bell's notifications, kept per account for the whole visit. Every page draws its own header,
// so without this the badge would blink empty on each page change.
const EMPTY = { notifications: [], unread: 0 }
const cache = new Map()
const checkedAt = new Map()
const listeners = new Set()
// A page change within this long reuses what the last page loaded instead of asking again.
const FRESH_MS = 15_000
// The last "mark read" on its way: a check waits for it, so it never brings back an old unread count.
let marking = Promise.resolve()

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function update(userId, change) {
  cache.set(userId, change(cache.get(userId) ?? EMPTY))
  for (const listener of listeners) listener()
}

// Tests start each case with nothing cached.
export function forgetNotifications() {
  cache.clear()
  checkedAt.clear()
  marking = Promise.resolve()
  for (const listener of listeners) listener()
}

// { data: { notifications, unread }, refresh, markRead(id | null for all) }
export function useNotifications() {
  const { user, getToken } = useAuth()
  const userId = user?.id
  const data = useSyncExternalStore(subscribe, () => (userId ? cache.get(userId) : undefined)) ?? EMPTY

  const refresh = useCallback(async () => {
    if (!userId || document.hidden) return
    try {
      await marking
      checkedAt.set(userId, Date.now())
      const next = await listNotifications(await getToken())
      update(userId, () => next)
    } catch {
      // The bell is a bonus: if it can't load, it just stays as it was.
    }
  }, [userId, getToken])

  const markRead = useCallback(
    async (id) => {
      if (!userId) return
      // Shown as read right away; the server's count follows.
      update(userId, (current) => {
        const wasUnread = current.notifications.some((item) => item.id === id && !item.read)
        return {
          notifications: current.notifications.map((item) => (id === null || item.id === id ? { ...item, read: true } : item)),
          unread: id === null ? 0 : Math.max(0, current.unread - (wasUnread ? 1 : 0)),
        }
      })
      const call = (async () => {
        try {
          const unread = await markNotificationsRead(id, await getToken())
          update(userId, (current) => ({ ...current, unread }))
        } catch {
          // The next check brings back the server's view.
        }
      })()
      marking = call
      await call
    },
    [userId, getToken],
  )

  useEffect(() => {
    if (Date.now() - (checkedAt.get(userId) ?? 0) > FRESH_MS) refresh()
  }, [refresh, userId])

  return { data, refresh, markRead }
}
