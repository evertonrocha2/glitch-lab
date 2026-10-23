// The Lab assistant: used by the API (limits, fallback routing) and the panel (names, chips).

// How much of the conversation the API reads, and how long each message may be.
export const ASSISTANT_LIMITS = { messages: 12, content: 2000, actions: 3 }

// The specialist agents the router can hand a question to.
export const SPECIALISTS = [
  { id: 'board', name: 'Board analyst', doing: 'is looking at your cases' },
  { id: 'gym', name: 'Gym coach', doing: 'is checking your gym challenges' },
  { id: 'notes', name: 'Notes keeper', doing: 'is reading your notes' },
  { id: 'study', name: 'Study planner', doing: 'is looking at your progress' },
  { id: 'guide', name: 'App guide', doing: 'is checking how the app works' },
]

export const SPECIALIST_IDS = SPECIALISTS.map((item) => item.id)

export const specialistName = (id) => SPECIALISTS.find((item) => item.id === id)?.name ?? 'Assistant'

export function pageKind(path) {
  const match = /^\/(board|gym|notes|progress)(\/|$)/.exec(typeof path === 'string' ? path : '')
  return match ? match[1] : 'other'
}

// The specialist that knows the page the student is looking at.
const PAGE_SPECIALIST = { board: 'board', gym: 'gym', notes: 'notes', progress: 'study', other: 'guide' }

// Word starts, so "hint" also matches "hints" and "spoil" matches "spoiling".
const KEYWORDS = {
  board: ['case', 'board', 'bug', 'error', 'weak', 'explain', 'why', 'concept', 'typeerror', 'undefined'],
  gym: ['gym', 'challenge', 'hint', 'exercise', 'train', 'stuck', 'spoil', 'attempt'],
  notes: ['note', 'notebook', 'summar', 'wrote', 'write'],
  study: ['xp', 'level', 'streak', 'badge', 'progress', 'plan', 'minute', 'hour', 'study', 'timer', 'next'],
  guide: ['how do', 'how can', 'how to', 'where', 'shortcut', 'feature', 'export', 'button', 'page', 'app'],
}

// Used when the router agent fails, and by the panel to guess who is working while it waits.
// The page's own specialist wins ties; at most two specialists, the second only on a keyword match.
export function pickSpecialists(question, page) {
  const text = String(question ?? '').toLowerCase()
  const home = PAGE_SPECIALIST[pageKind(page?.path)]
  const scored = SPECIALIST_IDS.map((id) => {
    const hits = KEYWORDS[id].filter((word) => new RegExp(`\\b${word}`).test(text)).length
    return { id, hits, score: hits + (id === home ? 0.5 : 0) }
  }).sort((a, b) => b.score - a.score)

  const matched = scored.filter((item) => item.hits > 0)
  if (!matched.length) return [home]
  return matched.slice(0, 2).map((item) => item.id)
}

// Starter questions in the panel, by page.
export const SUGGESTIONS = {
  board: ['What is my weak spot?', 'Which case should I train next?', 'Explain my latest case simply'],
  gym: ['Give me a hint without spoiling it', 'What should I look at first?', 'Why is this kind of bug common?'],
  notes: ['Summarize my notes', 'What should I write down next?', 'Which cases have no notes yet?'],
  progress: ['Plan my next 30 minutes', 'How do I reach the next level?', 'Which badge is closest?'],
  other: ['What can I do here?', 'What is my weak spot?', 'Plan my next 30 minutes'],
}
