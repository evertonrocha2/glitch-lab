// The study timer as plain data, so it survives reloads and every tab reads the same thing.
// { running, runStartedAt, sessionBase, lastSentAt, seenAt, unsent, focus, run }
// Times are ms. sessionBase is the clock face before this run, unsent is counted seconds the
// server hasn't confirmed yet (a failed report, a pause, a long gap), kept until they go through.
// focus is what the student said they're studying ({ topic, caseId, noteId }, kept across a pause).
// run is this run's session in the study log ({ id, startedAt, endedAt, opening, tries, detached }):
// id comes once the server opens it, endedAt once the run stops, and it stays until the server
// has closed it too (a failed close is tried again after the next report).

// Matches the server: one report never carries more than 10 minutes.
export const MAX_REPORT_SECONDS = 600
// A running timer whose tab hasn't been seen for this long was closed or asleep: it gets paused there.
export const STALE_MS = 150_000

export const NO_FOCUS = Object.freeze({ topic: '', caseId: null, noteId: null })

export const idle = () => ({ running: false, runStartedAt: null, sessionBase: 0, lastSentAt: null, seenAt: null, unsent: 0, focus: null, run: null })

// focus: what this run is about. Left out (Resume, the assistant's "start the timer"), the last
// one carries on.
export function start(state, now, focus) {
  if (state.running) return state
  return {
    ...state,
    running: true,
    runStartedAt: now,
    lastSentAt: now,
    seenAt: now,
    focus: focus ? { ...NO_FOCUS, ...focus } : (state.focus ?? null),
    run: { id: null, startedAt: now, endedAt: null, opening: null, tries: 0, detached: false },
  }
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

// The run's session ends here too (run.endedAt), once its last seconds are reported.
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
    run: state.run ? { ...state.run, endedAt: now } : null,
  }
}

// Clears the clock face and what it was about. Time not reported yet is still owed to the server,
// and a run the server hasn't closed yet still gets closed.
export const reset = (state) => ({ ...idle(), unsent: state.unsent ?? 0, run: state.run ?? null })

// A timer left running in a tab that's gone (or a laptop that slept) pauses where the tab was last
// seen, so its study session ends there too. Returns the same object when nothing changes.
export function restore(state, now) {
  if (!state) return idle()
  if (!state.running) return state
  const seen = state.seenAt ?? state.lastSentAt
  return now - seen <= STALE_MS ? state : pause(state, seen)
}

// The topic or link changed (while running, or paused before a Resume).
export const setFocus = (state, focus) => ({ ...state, focus: { ...NO_FOCUS, ...state.focus, ...focus } })

// Runs are told apart by when they started: a late answer about an older run changes nothing.
const sameRun = (state, run) => Boolean(state.run && run && state.run.startedAt === run.startedAt)

// A tab asks the server to open the run's session at `now` (null: the attempt is over).
export function markOpening(state, run, now) {
  if (!sameRun(state, run)) return state
  return { ...state, run: { ...state.run, opening: now, tries: (state.run.tries ?? 0) + (now ? 1 : 0) } }
}

// The server opened the run's session.
export const runOpened = (state, run, id) => (sameRun(state, run) ? { ...state, run: { ...state.run, id, opening: null } } : state)

// A report answered with the session to use next: the same one, a new one after midnight, or null
// when the server no longer has it open (then this run stops writing to the log).
export function runMoved(state, fromId, toId) {
  if (!state.run || state.run.id !== fromId || fromId === toId) return state
  return { ...state, run: { ...state.run, id: toId, detached: toId === null } }
}

// The server closed (or dropped) the run's session: nothing left to send about it.
export const runClosed = (state, run) => (sameRun(state, run) && !state.running ? { ...state, run: null } : state)
