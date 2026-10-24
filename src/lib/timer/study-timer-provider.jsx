import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AuthError, addStudyTime, startStudySession, stopStudySession, updateStudySession } from '../api.js'
import { useAuth } from '../auth/auth-provider.jsx'
import { localDay } from '../day.js'
import { useProgressRefresh } from '../progress/progress-provider.jsx'
import {
  elapsed,
  giveBack,
  heartbeat,
  idle,
  markOpening,
  NO_FOCUS,
  pause as pauseClock,
  pendingSeconds,
  reset as resetClock,
  restore,
  runClosed,
  runMoved,
  runOpened,
  setFocus as setClockFocus,
  start as startClock,
  takeUnsent,
} from './clock.js'

// Three contexts so the ticking stays at the leaves: TimerContext changes only when the timer starts
// or stops (a page with a Start button doesn't re-render every second), FocusContext only when the
// topic or link changes, StateContext carries the part of the saved state the clock face reads,
// and the few components that show the clock tick on their own (useStudyClock).
const TimerContext = createContext(null)
const FocusContext = createContext(NO_FOCUS)
const StateContext = createContext(null)
export const REPORT_EVERY_MS = 60_000
// Well under STALE_MS, so a live tab is never mistaken for a closed one.
const HEARTBEAT_EVERY_MS = 15_000
// Another tab may be opening the run's session right now: wait this long before trying ourselves.
const OPEN_WAIT_MS = 30_000
// A run whose session can't be opened (offline, demo limit) stops trying after this many times.
const OPEN_TRIES = 3

const keyFor = (userId) => `gd:timer:${userId}`
const iso = (ms) => new Date(ms).toISOString()
// 4xx: the server answered and the session is gone or can't be written. Anything else may pass.
const refused = (err) => err?.status >= 400 && err.status < 500

function write(userId, state) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(state))
  } catch {
    // Storage blocked: the timer still works, it just won't survive a reload.
  }
}

// Reads the shared timer. If it had to pause a stale run, that pause is saved right away,
// so every tab (and the next report) agrees the timer stopped. A timer saved before the study log
// existed has no focus or run yet.
function load(userId) {
  let raw = null
  try {
    raw = JSON.parse(localStorage.getItem(keyFor(userId)))
  } catch {
    return idle()
  }
  const state = restore(raw && { focus: null, run: null, ...raw }, Date.now())
  if (raw && state.running !== raw.running) write(userId, state)
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

  // Asks the server to open the running run's session, unless it's open, given up on, or another
  // tab is on it. Reads the topic fresh, so an edit made before it opened goes along.
  const openRun = useCallback(async () => {
    const current = load(userId)
    const run = current.run
    if (!current.running || !run || run.id || run.detached || (run.tries ?? 0) >= OPEN_TRIES) return
    if (run.opening && Date.now() - run.opening < OPEN_WAIT_MS) return
    save(markOpening(current, run, Date.now()))
    const focus = current.focus ?? NO_FOCUS
    try {
      const session = await startStudySession(
        { topic: focus.topic, caseId: focus.caseId, noteId: focus.noteId, day: localDay(new Date(run.startedAt)), startedAt: iso(run.startedAt) },
        await getToken(),
      )
      save(runOpened(load(userId), run, session.id))
    } catch {
      // The next report tries again (up to OPEN_TRIES); the time itself is counted either way.
      save(markOpening(load(userId), run, null))
    }
  }, [userId, getToken, save])

  // Ends a stopped run's session where it stopped. A failed close is tried again later; a refused
  // one (already gone) is simply forgotten.
  const closeRun = useCallback(
    async (run, { keepalive = false } = {}) => {
      if (run.id && !run.detached) {
        try {
          await stopStudySession(run.id, { endedAt: iso(run.endedAt ?? Date.now()) }, await getToken(), { keepalive })
        } catch (err) {
          if (!refused(err)) return
        }
      }
      save(runClosed(load(userId), run))
    },
    [userId, getToken, save],
  )

  // Sends the time not reported yet, to the run's session too. Storage is read fresh so two tabs
  // don't send the same seconds. Once a stopped run owes nothing, its session gets closed.
  const report = useCallback(
    async ({ keepalive = false } = {}) => {
      if (!userId) return
      if (!keepalive) await openRun()
      const { seconds, state: next } = takeUnsent(load(userId), Date.now())
      if (seconds >= 1) {
        save(next)
        const sessionId = next.run?.detached ? null : (next.run?.id ?? null)
        try {
          const body = sessionId ? { seconds, day: localDay(), sessionId } : { seconds, day: localDay() }
          const answer = await addStudyTime(body, await getToken(), { keepalive })
          if (sessionId && answer && 'sessionId' in answer) save(runMoved(load(userId), sessionId, answer.sessionId))
          refresh()
        } catch (err) {
          // Offline for a moment: the seconds wait for the next report.
          if (!(err instanceof AuthError)) save(giveBack(load(userId), seconds))
          return
        }
      }
      const after = load(userId)
      if (!keepalive && !after.running && after.run && pendingSeconds(after, Date.now()) < 1) await closeRun(after.run)
    },
    [userId, getToken, save, refresh, openRun, closeRun],
  )

  // A new sign-in picks up its own timer and sends anything a closed tab left owed (closing the
  // session that tab left open, at its last heartbeat).
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

  // focus: { topic, caseId, noteId } for this run. Click handlers pass an event: that's no focus.
  const start = useCallback(
    async (focus) => {
      const current = load(userId)
      if (current.running) return
      const given = focus && typeof focus === 'object' && 'topic' in focus ? focus : undefined
      // A stopped run whose close never went through: closed now, before the new one opens.
      const leftover = current.run
      save(startClock(current, Date.now(), given))
      if (leftover) await closeRun(leftover)
      await openRun()
    },
    [userId, save, openRun, closeRun],
  )

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

  // A new topic or link, saved on the open session too (an unopened one takes it when it opens).
  const setFocus = useCallback(
    async (focus) => {
      const current = setClockFocus(load(userId), focus)
      save(current)
      const run = current.run
      if (!current.running || !run?.id || run.detached) return
      try {
        await updateStudySession(run.id, focus, await getToken())
      } catch {
        // The timer keeps the new topic; the log can be fixed on /study.
      }
    },
    [userId, getToken, save],
  )

  const running = state.running
  // Stopped with time on the clock: Resume and Reset instead of Start.
  const paused = !running && state.sessionBase > 0
  const value = useMemo(() => ({ running, paused, start, pause, reset, setFocus }), [running, paused, start, pause, reset, setFocus])
  const { topic = '', caseId = null, noteId = null } = state.focus ?? NO_FOCUS
  const focus = useMemo(() => ({ topic, caseId, noteId }), [topic, caseId, noteId])
  // Only what the clock face reads: heartbeats and the study log's bookkeeping don't redraw it.
  const { runStartedAt, sessionBase, lastSentAt, unsent } = state
  const clockState = useMemo(() => ({ running, runStartedAt, sessionBase, lastSentAt, unsent }), [running, runStartedAt, sessionBase, lastSentAt, unsent])
  return (
    <TimerContext.Provider value={value}>
      <FocusContext.Provider value={focus}>
        <StateContext.Provider value={clockState}>{children}</StateContext.Provider>
      </FocusContext.Provider>
    </TimerContext.Provider>
  )
}

// { running, paused, start, pause, reset, setFocus }. Doesn't tick: the seconds come from useStudyClock().
export function useStudyTimer() {
  const value = useContext(TimerContext)
  if (!value) throw new Error('useStudyTimer must be used inside <StudyTimerProvider>')
  return value
}

// { topic, caseId, noteId }: what the timer says you're studying. Changes only when that does.
export function useStudyFocus() {
  return useContext(FocusContext)
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
