const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

// Thrown on 401 so pages can send the person back to the login screen.
export class AuthError extends Error {}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new Error('Could not reach the server. Check your connection.')
  }

  const data = await res.json().catch(() => null)
  if (res.status === 401) throw new AuthError(data?.message || 'Sign in to continue.')
  if (!res.ok || !data) throw new Error(data?.message || GENERIC_MESSAGE)
  return data
}

export async function analyzeError({ error, code }, token) {
  return (await request('/api/analyze', { method: 'POST', body: { error, code }, token })).case
}

export async function listCases(token) {
  return (await request('/api/cases', { token })).cases
}

export async function startChallenge(caseId, token) {
  return (await request('/api/challenge', { method: 'POST', body: { caseId }, token })).challenge
}

export async function getChallenge(id, token) {
  return (await request(`/api/challenge?id=${encodeURIComponent(id)}`, { token })).challenge
}

// { hint, hintsRevealed }
export function revealHint(challengeId, token) {
  return request('/api/hint', { method: 'POST', body: { challengeId }, token })
}

// { passed, feedback, case }
export function checkFix(challengeId, code, token) {
  return request('/api/check', { method: 'POST', body: { challengeId, code }, token })
}
