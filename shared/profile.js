// Profile rules shared by the API (which enforces them) and the editor (which hints at them).
export const PROFILE_LIMITS = { handleMin: 3, handleMax: 20, displayName: 40, bio: 160, seed: 40, featured: 3 }

// Purple, blue and gray only, like the rest of Pixel Lab. The first one is the default.
export const AVATAR_COLORS = [
  { id: 'violet', name: 'Violet' },
  { id: 'cobalt', name: 'Cobalt' },
  { id: 'grape', name: 'Grape' },
  { id: 'sky', name: 'Sky' },
  { id: 'ink', name: 'Ink' },
]

const HANDLE_CHARS = /^[a-z0-9_-]+$/

export const normalizeHandle = (value) => value.trim().toLowerCase()

// A message saying what's wrong with the handle, or null when it's fine.
export function handleProblem(handle) {
  if (handle.length < PROFILE_LIMITS.handleMin) return `Use at least ${PROFILE_LIMITS.handleMin} characters.`
  if (handle.length > PROFILE_LIMITS.handleMax) return `Use up to ${PROFILE_LIMITS.handleMax} characters.`
  if (!HANDLE_CHARS.test(handle)) return 'Use only lowercase letters, numbers, _ and -.'
  return null
}

// The name shown until the person picks one: the part of their email before the @.
export function defaultDisplayName({ email, isDemo }) {
  if (isDemo) return 'Demo Detective'
  const name = (email ?? '').split('@')[0].trim()
  return name ? name.slice(0, PROFILE_LIMITS.displayName) : 'Detective'
}
