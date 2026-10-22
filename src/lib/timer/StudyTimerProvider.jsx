import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AuthError, addStudyTime } from '../api.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { localDay } from '../day.js'
import { useProgress } from '../progress/ProgressProvider.jsx'
import { elapsed, idle, pause as pauseClock, restore, start as startClock, takeUnsent } from './clock.js'

const TimerContext = createContext(null)
export const REPORT_EVERY_MS = 60_000

const keyFor = (userId) => `gd:timer:${userId}`

function read(userId) {
  try {
    return restore(JSON.parse(localStorage.getItem(keyFor(userId))), Date.now())
  } catch {
    return idle()
  }
}

function write(userId, state) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(state))
  } catch {
    // Storage blocked: the timer still works, it just won't survive a reload.
  }
}

export function StudyTimerProvider({ children }) {
  const { user, getToken } = useAuth()
  const { refresh } = useProgress()
  const userId = user?.id
  const [state, setState] = useState(() => (userId ? read(userId) : idle()))
  const [now, setNow] = useState(() => Date.now())

  const save = useCallback(
    (next) => {
      if (userId) write(userId, next)
      setState(next)
    },
    [userId],
  )

  useEffect(() => {
    if (userId) setState(read(userId))
  }, [userId])

  // Sends the time not reported yet. Storage is read fresh so two tabs don't send the same seconds.
  const report = useCallback(
    async ({ keepalive = false } = {}) => {
      if (!userId) return
      const { seconds, state: next } = takeUnsent(read(userId), Date.now())
      if (seconds < 1) return
      save(next)
      try {
        await addStudyTime({ seconds, day: localDay() }, await getToken(), { keepalive })
        refresh()
      } catch (err) {
        // Offline for a moment: give the seconds back so the next report carries them.
        if (!(err instanceof AuthError)) {
          const current = read(userId)
          if (current.running) save({ ...current, lastSentAt: current.lastSentAt - seconds * 1000 })
        }
      }
    },
    [userId, getToken, save, refresh],
  )

  useEffect(() => {
    if (!state.running) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const send = setInterval(report, REPORT_EVERY_MS)
    return () => {
      clearInterval(tick)
      clearInterval(send)
    }
  }, [state.running, report])

  useEffect(() => {
    if (!userId) return
    const onHide = () => report({ keepalive: true })
    // Another tab started or paused the timer.
    const onStorage = (event) => {
      if (event.key === keyFor(userId)) setState(read(userId))
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
    save(startClock(read(userId), moment))
  }, [userId, save])

  const pause = useCallback(async () => {
    await report()
    const moment = Date.now()
    setNow(moment)
    save(pauseClock(read(userId), moment))
  }, [userId, report, save])

  const reset = useCallback(async () => {
    await report()
    save(idle())
  }, [report, save])

  const value = useMemo(
    () => ({
      running: state.running,
      seconds: elapsed(state, now),
      // Time already counted but not reported yet, so "today" can tick live.
      unsentSeconds: state.running ? Math.max(0, Math.floor((now - state.lastSentAt) / 1000)) : 0,
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
