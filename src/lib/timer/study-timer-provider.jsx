import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AuthError, addStudyTime } from '../api.js'
import { useAuth } from '../auth/auth-provider.jsx'
import { localDay } from '../day.js'
import { useProgressRefresh } from '../progress/progress-provider.jsx'
import {
  elapsed,
  giveBack,
  heartbeat,
  idle,
  pause as pauseClock,
  pendingSeconds,
  reset as resetClock,
  restore,
  start as startClock,
  takeUnsent,
} from './clock.js'

// Two contexts so the ticking stays at the leaves: TimerContext changes only when the timer starts
// or stops (a page with a Start button doesn't re-render every second), StateContext carries the
// saved state, and the few components that show the clock tick on their own (useStudyClock).
const TimerContext = createContext(null)
const StateContext = createContext(null)
export const REPORT_EVERY_MS = 60_000
// Well under STALE_MS, so a live tab is never mistaken for a closed one.
const HEARTBEAT_EVERY_MS = 15_000

const keyFor = (userId) => `gd:timer:${userId}`

function write(userId, state) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(state))
  } catch {
    // Storage blocked: the timer still works, it just won't survive a reload.
  }
}

// Reads the shared timer. If it had to pause a stale run, that pause is saved right away,
// so every tab (and the next report) agrees the timer stopped.
function load(userId) {
  let raw = null
  try {
    raw = JSON.parse(localStorage.getItem(keyFor(userId)))
  } catch {
    return idle()
  }
  const state = restore(raw, Date.now())
  if (raw && state !== raw) write(userId, state)
  return state
}

export function StudyTimerProvider({ children }) {
  const { user, getToken } = useAuth()
  const refresh = useProgressRefresh()
  const userId = user?.id
  const [state, setState] = useState(() => (userId ? load(userId) : idle()))

  const save = useCallback(
    (next) => {
      if (userId) write(userId, next)
      setState(next)
    },
    [userId],
  )

  // Sends the time not reported yet. Storage is read fresh so two tabs don't send the same seconds.
  const report = useCallback(
    async ({ keepalive = false } = {}) => {
      if (!userId) return
      const { seconds, state: next } = takeUnsent(load(userId), Date.now())
      if (seconds < 1) return
      save(next)
      try {
        await addStudyTime({ seconds, day: localDay() }, await getToken(), { keepalive })
        refresh()
      } catch (err) {
        // Offline for a moment: the seconds wait for the next report.
        if (!(err instanceof AuthError)) save(giveBack(load(userId), seconds))
      }
    },
    [userId, getToken, save, refresh],
  )

  // A new sign-in picks up its own timer and sends anything a closed tab left owed.
  useEffect(() => {
    if (!userId) return
    setState(load(userId))
    report()
  }, [userId, report])

  useEffect(() => {
    if (!userId) return
    const send = setInterval(report, REPORT_EVERY_MS)
    return () => clearInterval(send)
  }, [userId, report])

  useEffect(() => {
    if (!state.running) return
    const beat = setInterval(() => {
      const current = load(userId)
      // load() already paused it if this tab slept past STALE_MS.
      save(current.running ? heartbeat(current, Date.now()) : current)
    }, HEARTBEAT_EVERY_MS)
    return () => clearInterval(beat)
  }, [state.running, userId, save])

  useEffect(() => {
    if (!userId) return
    const onHide = () => report({ keepalive: true })
    // Another tab started or paused the timer.
    const onStorage = (event) => {
      if (event.key === keyFor(userId)) setState(load(userId))
    }
    window.addEventListener('pagehide', onHide)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('storage', onStorage)
    }
  }, [userId, report])

  const start = useCallback(() => {
    save(startClock(load(userId), Date.now()))
  }, [userId, save])

  const pause = useCallback(async () => {
    const moment = Date.now()
    // Pause first: the counted seconds move into `unsent`, so a failed report can't lose them.
    save(pauseClock(load(userId), moment))
    await report()
  }, [userId, report, save])

  const reset = useCallback(async () => {
    save(resetClock(load(userId)))
    await report()
  }, [userId, report, save])

  const running = state.running
  const value = useMemo(() => ({ running, start, pause, reset }), [running, start, pause, reset])
  return (
    <TimerContext.Provider value={value}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </TimerContext.Provider>
  )
}

// { running, start, pause, reset }. Doesn't tick: the seconds come from useStudyClock().
export function useStudyTimer() {
  const value = useContext(TimerContext)
  if (!value) throw new Error('useStudyTimer must be used inside <StudyTimerProvider>')
  return value
}

// Re-renders its component once a second while `active` and the tab is visible; a hidden tab
// catches up the moment it shows again.
function useSecondTick(active) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    let timer = null
    const bump = () => setTick((tick) => tick + 1)
    const sync = () => {
      clearInterval(timer)
      timer = null
      if (document.hidden) return
      bump()
      timer = setInterval(bump, 1000)
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [active])
}

// { seconds, unsentSeconds }: the clock face, and what's counted but not reported yet (so "today"
// can tick live). Only the component that calls this ticks, once a second while the timer runs.
export function useStudyClock() {
  const state = useContext(StateContext)
  if (!state) throw new Error('useStudyClock must be used inside <StudyTimerProvider>')
  useSecondTick(state.running)
  // Read at render, so a fresh start or pause never shows a clock older than the state.
  const now = Date.now()
  return { seconds: elapsed(state, now), unsentSeconds: pendingSeconds(state, now) }
}
