// The study timer as plain data, so it survives reloads and every tab reads the same thing.
// { running, runStartedAt, sessionBase, lastSentAt }: times in ms, sessionBase in seconds.

// Matches the server: one report never carries more than 10 minutes.
export const MAX_REPORT_SECONDS = 600
// A running timer that hasn't reported for this long was in a closed tab: it gets paused.
export const STALE_MS = 150_000

export const idle = () => ({ running: false, runStartedAt: null, sessionBase: 0, lastSentAt: null })

export function start(state, now) {
  if (state.running) return state
  return { ...state, running: true, runStartedAt: now, lastSentAt: now }
}

// Seconds on the clock face for this session.
export function elapsed(state, now) {
  return state.sessionBase + (state.running ? (now - state.runStartedAt) / 1000 : 0)
}

// Whole seconds not reported yet, and the state that marks them as reported. Leftover fractions wait.
export function takeUnsent(state, now) {
  if (!state.running) return { seconds: 0, state }
  const pending = Math.floor((now - state.lastSentAt) / 1000)
  if (pending < 1) return { seconds: 0, state }
  if (pending > MAX_REPORT_SECONDS) return { seconds: MAX_REPORT_SECONDS, state: { ...state, lastSentAt: now } }
  return { seconds: pending, state: { ...state, lastSentAt: state.lastSentAt + pending * 1000 } }
}

export function pause(state, now) {
  if (!state.running) return state
  return { running: false, runStartedAt: null, sessionBase: elapsed(state, now), lastSentAt: null }
}

// Coming back to a timer that ran in a tab that's gone: keep only the time that was reported.
export function restore(state, now) {
  if (!state?.running) return state ?? idle()
  if (now - state.lastSentAt <= STALE_MS) return state
  return pause(state, state.lastSentAt)
}
