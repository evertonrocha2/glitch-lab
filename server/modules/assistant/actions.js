import { ASSISTANT_LIMITS } from '../../../shared/assistant.js'
import { clip } from './text.js'

export const ACTION_TYPES = ['open_case', 'open_note', 'train_case', 'start_timer', 'go']

// Used when the AI leaves a label blank, in the reader's language.
const DEFAULT_LABELS = {
  en: {
    open_case: 'Open the case',
    open_note: 'Open the note',
    train_case: 'Train this case',
    start_timer: 'Start the study timer',
    go: 'Go there',
  },
  'pt-BR': {
    open_case: 'Abrir o caso',
    open_note: 'Abrir a nota',
    train_case: 'Treinar este caso',
    start_timer: 'Iniciar o cronômetro de estudo',
    go: 'Ir para lá',
  },
}
// Pages an answer may send the student to. Gym pages are checked against the student's challenges.
const PAGES = ['/board', '/notes', '/progress', '/trail']
const GYM_PAGE = /^\/gym\/([\w-]{1,64})$/

const isId = (value) => typeof value === 'string' && value !== '' && value.length <= 64

// The AI only suggests; the server decides. Returns { target, href? } for an allowed action, or null.
async function resolve(store, userId, { type, target }) {
  switch (type) {
    case 'open_case':
      return isId(target) && (await store.getCase(userId, target)) ? { target, href: `/board?case=${target}` } : null
    case 'train_case':
      // No link: the panel starts (or resumes) the challenge the same way the board does.
      return isId(target) && (await store.getCase(userId, target)) ? { target } : null
    case 'open_note':
      return isId(target) && (await store.getNote(userId, target)) ? { target, href: `/notes/${target}` } : null
    case 'start_timer':
      return { target: '' }
    case 'go': {
      if (PAGES.includes(target)) return { target, href: target }
      const gym = typeof target === 'string' ? GYM_PAGE.exec(target) : null
      return gym && (await store.getChallenge(userId, gym[1])) ? { target, href: target } : null
    }
    default:
      return null
  }
}

// Keeps actions whose ids belong to this student and whose pages are allowed, without repeats, at most three.
export async function validateActions(store, userId, actions, locale = 'en') {
  const defaults = DEFAULT_LABELS[locale] ?? DEFAULT_LABELS.en
  const kept = []
  for (const action of Array.isArray(actions) ? actions : []) {
    if (kept.length === ASSISTANT_LIMITS.actions) break
    if (!action || typeof action !== 'object' || !ACTION_TYPES.includes(action.type)) continue
    const resolved = await resolve(store, userId, action)
    if (!resolved || kept.some((item) => item.type === action.type && item.target === resolved.target)) continue
    const label = typeof action.label === 'string' && action.label.trim() ? clip(action.label.trim(), 40) : defaults[action.type]
    kept.push({ type: action.type, target: resolved.target, label, ...(resolved.href ? { href: resolved.href } : {}) })
  }
  return kept
}
