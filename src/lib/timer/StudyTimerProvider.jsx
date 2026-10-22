import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AuthError, addStudyTime } from '../api.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { localDay } from '../day.js'
import { useProgress } from '../progress/ProgressProvider.jsx'
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

const TimerContext = createContext(null)
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
  const { refresh } = useProgress()
  const userId = user?.id
  const [state, setState] = useState(() => (userId ? load(userId) : idle()))
  const [now, setNow] = useState(() => Date.now())

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
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const beat = setInterval(() => {
      const current = load(userId)
      // load() already paused it if this tab slept past STALE_MS.
      save(current.running ? heartbeat(current, Date.now()) : current)
    }, HEARTBEAT_EVERY_MS)
    return () => {
      clearInterval(tick)
      clearInterval(beat)
    }
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
    const moment = Date.now()
    setNow(moment)
    save(startClock(load(userId), moment))
  }, [userId, save])

  const pause = useCallback(async () => {
    const moment = Date.now()
    setNow(moment)
    // Pause first: the counted seconds move into `unsent`, so a failed report can't lose them.
    save(pauseClock(load(userId), moment))
    await report()
  }, [userId, report, save])

  const reset = useCallback(async () => {
    save(resetClock(load(userId)))
    await report()
  }, [userId, report, save])

  const value = useMemo(
    () => ({
      running: state.running,
      seconds: elapsed(state, now),
      // Counted but not reported yet, so "today" can tick live.
      unsentSeconds: pendingSeconds(state, now),
      start,
      pause,
      reset,
    }),
    [state, now, start, pause, reset],
  )
  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

// { running, seconds, unsentSeconds, start, pause, reset }
export function useStudyTimer() {
  const value = useContext(TimerContext)
  if (!value) throw new Error('useStudyTimer must be used inside <StudyTimerProvider>')
  return value
}
