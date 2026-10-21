// The error someone pasted on the landing survives the trip through the login screen.
const KEY = 'gd:draft'

export function saveDraft({ error, code }) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ error, code }))
  } catch {
    // Storage blocked (private mode): the person just pastes again.
  }
}

export function takeDraft() {
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
