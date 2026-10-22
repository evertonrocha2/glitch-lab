// The error someone pasted on the landing survives the trip through the login screen.
const KEY = 'gd:draft'

export function saveDraft({ error, code, context, files }) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ error, code, context, files }))
  } catch {
    // Storage blocked (private mode): the person just pastes again.
  }
}

// The gym keeps a half-written fix per challenge if the session expires mid-edit.
const gymKey = (challengeId) => `gd:gym-draft:${challengeId}`

export function saveGymDraft(challengeId, code) {
  try {
    sessionStorage.setItem(gymKey(challengeId), code)
  } catch {
    // Storage blocked: nothing to restore later.
  }
}

export function takeGymDraft(challengeId) {
  try {
    const code = sessionStorage.getItem(gymKey(challengeId))
    sessionStorage.removeItem(gymKey(challengeId))
    return code
  } catch {
    return null
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
