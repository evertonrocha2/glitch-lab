// Interrogation: a guided debugging session on one case. The student walks the method one step at a
// time, the AI coach grades each answer, and a step only opens once the one before it passed.
// Shared by the API (grading, saving) and the app (the stepper, the timeline, the note export).

export const INTERROGATION_STEPS = ['reproduce', 'read', 'hypothesis', 'isolate', 'fix', 'prevent']
// Before this step the coach must never hand out the fix (see api/_lib/interrogation/guard.js).
export const FIX_STEP = INTERROGATION_STEPS.indexOf('fix')
// Paid once per case: there is one interrogation per case, and only a finished one counts.
export const INTERROGATION_XP = 60
// answer: one student answer. feedback: what is kept of the coach's reply. turns: answers per case,
// so a stuck student can't grow one record forever.
export const INTERROGATION_LIMITS = { answer: 1200, feedback: 600, turns: 60 }

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text)

// A case nobody has interrogated yet.
export const emptyInterrogation = (caseId) => ({ caseId, step: 0, turns: [], completedAt: null })

export const isFinished = (state) => (state?.step ?? 0) >= INTERROGATION_STEPS.length

// The step the student is on, as its id; null once every step passed.
export const currentStep = (state) => INTERROGATION_STEPS[state?.step ?? 0] ?? null

// How many answers the student already gave on the step they are on.
export const triesOnStep = (state) => (state?.turns ?? []).filter((turn) => turn.step === currentStep(state)).length

// The state after one graded answer. verdict: { passed, feedback, question }. Never edits `state`.
export function advance(state, answer, verdict, at = new Date().toISOString()) {
  const step = currentStep(state)
  if (!step) return state
  const passed = Boolean(verdict.passed)
  const turn = {
    step,
    answer: clip(answer.trim(), INTERROGATION_LIMITS.answer),
    feedback: clip(String(verdict.feedback ?? '').trim(), INTERROGATION_LIMITS.feedback),
    // One guiding question, only when the answer was off.
    question: passed ? '' : clip(String(verdict.question ?? '').trim(), INTERROGATION_LIMITS.feedback),
    passed,
    at,
  }
  const next = (state.step ?? 0) + (passed ? 1 : 0)
  return {
    ...state,
    step: next,
    turns: [...state.turns, turn],
    completedAt: next >= INTERROGATION_STEPS.length ? (state.completedAt ?? at) : null,
  }
}

// One row per step for the timeline: the answer that passed it (or null), the coach's word on it,
// and how many tries it took.
export function timeline(state) {
  const turns = state?.turns ?? []
  return INTERROGATION_STEPS.map((id, index) => {
    const mine = turns.filter((turn) => turn.step === id)
    const passed = mine.find((turn) => turn.passed) ?? null
    return {
      id,
      index,
      status: passed ? 'passed' : index === (state?.step ?? 0) ? 'current' : 'locked',
      answer: passed?.answer ?? null,
      feedback: passed?.feedback ?? null,
      tries: mine.length,
    }
  })
}

// computeProgress's `interrogation` input: { completed }, how many cases were fully interrogated.
export const NO_INTERROGATION = { completed: 0 }
export function interrogationSummary(list = []) {
  return { completed: list.filter((item) => isFinished(item) && item.completedAt).length }
}
