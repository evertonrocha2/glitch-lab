import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getProgress } from '../api.js'
import { useAuth } from '../auth/auth-provider.jsx'
import { localDay } from '../day.js'

// Split so a page that only calls refresh() doesn't re-render when the numbers or toasts change.
const ProgressContext = createContext(null)
const RefreshContext = createContext(null)
const ToastsContext = createContext(null)

const seenKey = (userId) => `gd:badges-seen:${userId}`

function readSeen(userId) {
  try {
    return JSON.parse(localStorage.getItem(seenKey(userId)))
  } catch {
    return null
  }
}

function writeSeen(userId, ids) {
  try {
    localStorage.setItem(seenKey(userId), JSON.stringify(ids))
  } catch {
    // Storage blocked: a badge may be announced twice, nothing worse.
  }
}

// Badges earned since this browser last looked. The very first look announces nothing,
// so an account that already has badges doesn't get a pile of toasts.
export function newlyEarned(userId, progress) {
  const earned = progress.badges.filter((badge) => badge.earned).map((badge) => badge.id)
  const seen = readSeen(userId)
  writeSeen(userId, [...new Set([...(seen ?? []), ...earned])])
  return seen ? earned.filter((id) => !seen.includes(id)) : []
}

export function ProgressProvider({ children }) {
  const { user, getToken } = useAuth()
  const [progress, setProgress] = useState(null)
  const [toasts, setToasts] = useState([])
  const userId = user?.id
  const latest = useRef(0)

  const refresh = useCallback(async () => {
    if (!userId) return
    const call = ++latest.current
    try {
      const next = await getProgress(localDay(), await getToken())
      // An older answer arriving late must not overwrite a newer one.
      if (call !== latest.current) return
      setProgress(next)
      const fresh = newlyEarned(userId, next)
      if (fresh.length) setToasts((current) => [...current, ...fresh.filter((id) => !current.includes(id))])
    } catch {
      // Progress is a bonus: if it can't load, the page still works.
    }
  }, [userId, getToken])

  useEffect(() => {
    setProgress(null)
    setToasts([])
    refresh()
  }, [refresh])

  const dismissToast = useCallback((id) => setToasts((current) => current.filter((item) => item !== id)), [])

  const toastsValue = useMemo(() => ({ toasts, dismissToast }), [toasts, dismissToast])
  return (
    <RefreshContext.Provider value={refresh}>
      <ProgressContext.Provider value={progress}>
        <ToastsContext.Provider value={toastsValue}>{children}</ToastsContext.Provider>
      </ProgressContext.Provider>
    </RefreshContext.Provider>
  )
}

// Asks the server for fresh numbers (after an action that earns XP). Stable: never re-renders its caller.
export function useProgressRefresh() {
  const refresh = useContext(RefreshContext)
  if (!refresh) throw new Error('useProgressRefresh must be used inside <ProgressProvider>')
  return refresh
}

// { toasts (badge ids to announce), dismissToast }
export function useBadgeToasts() {
  const value = useContext(ToastsContext)
  if (!value) throw new Error('useBadgeToasts must be used inside <ProgressProvider>')
  return value
}

// The numbers (level, XP, today's time...), null until they load.
export const useProgressData = () => useContext(ProgressContext)

// { progress, refresh, toasts, dismissToast }: everything, for components that show the numbers.
export function useProgress() {
  const refresh = useProgressRefresh()
  const progress = useContext(ProgressContext)
  const { toasts, dismissToast } = useBadgeToasts()
  return { progress, refresh, toasts, dismissToast }
}
