import { AuthUnavailableError, getUser } from './auth.js'

export const ok = (body, status = 200) => Response.json(body, { status })

export const fail = (status, message) => Response.json({ message }, { status })

// null when the body is missing, not JSON, or not an object.
export async function readJson(request) {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body : null
  } catch {
    return null
  }
}

// Either { user } or { response }: 401 when signed out, 503 when the sign-in service itself is down.
export async function requireUser(request) {
  let user
  try {
    user = await getUser(request)
  } catch (err) {
    if (!(err instanceof AuthUnavailableError)) throw err
    console.error('auth unavailable:', err.message)
    return { response: fail(503, 'Sign-in is unavailable right now. Try again in a minute.') }
  }
  return user ? { user } : { response: fail(401, 'Sign in to continue.') }
}
