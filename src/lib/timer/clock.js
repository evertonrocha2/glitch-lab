// The study timer as plain data, so it survives reloads and every tab reads the same thing.
// { running, runStartedAt, sessionBase, lastSentAt, seenAt, unsent }
// Times are ms. sessionBase is the clock face before this run, unsent is counted seconds the
// server hasn't confirmed yet (a failed report, a pause, a long gap), kept until they go through.

// Matches the server: one report never carries more than 10 minutes.
export const MAX_REPORT_SECONDS = 600
// A running timer whose tab hasn't been seen for this long was closed or asleep: it gets paused there.
export const STALE_MS = 150_000

export const idle = () => ({ running: false, runStartedAt: null, sessionBase: 0, lastSentAt: null, seenAt: null, unsent: 0 })

export function start(state, now) {
  if (state.running) return state
  return { ...state, running: true, runStartedAt: now, lastSentAt: now, seenAt: now }
}

// The open tab says it's still alive. Network trouble doesn't stop this, only a closed or sleeping tab.
export function heartbeat(state, now) {
  return state.running ? { ...state, seenAt: now } : state
}

// Seconds on the clock face for this session.
export function elapsed(state, now) {
  return state.sessionBase + (state.running ? (now - state.runStartedAt) / 1000 : 0)
}

const liveSeconds = (state, now) => (state.running ? Math.max(0, Math.floor((now - state.lastSentAt) / 1000)) : 0)

// Everything counted but not confirmed by the server yet.
export const pendingSeconds = (state, now) => (state.unsent ?? 0) + liveSeconds(state, now)

// The seconds to report now, and the state that marks them as on their way. Fractions wait for
// the next report; anything over the per-report cap stays in `unsent` for the next one.
export function takeUnsent(state, now) {
  const live = liveSeconds(state, now)
  const total = (state.unsent ?? 0) + live
  if (total < 1) return { seconds: 0, state }
  const seconds = Math.min(total, MAX_REPORT_SECONDS)
  const lastSentAt = state.running ? state.lastSentAt + live * 1000 : state.lastSentAt
  return { seconds, state: { ...state, lastSentAt, unsent: total - seconds } }
}

// A report failed: those seconds go back in line.
export function giveBack(state, seconds) {
  return { ...state, unsent: (state.unsent ?? 0) + seconds }
}

export function pause(state, now) {
  if (!state.running) return state
  return {
    ...state,
    running: false,
    runStartedAt: null,
    sessionBase: elapsed(state, now),
    lastSentAt: null,
    seenAt: null,
    unsent: pendingSeconds(state, now),
  }
}

// Clears the clock face; time not reported yet is still owed to the server.
export const reset = (state) => ({ ...idle(), unsent: state.unsent ?? 0 })

// A timer left running in a tab that's gone (or a laptop that slept) pauses where the tab was last seen.
// Returns the same object when nothing changes.
export function restore(state, now) {
  if (!state) return idle()
  if (!state.running) return state
  const seen = state.seenAt ?? state.lastSentAt
  return now - seen <= STALE_MS ? state : pause(state, seen)
}
