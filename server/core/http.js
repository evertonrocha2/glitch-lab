import { getUser } from './middlewares/auth.js'

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

// Either { user } or { response } with the 401 to send back.
export async function requireUser(request) {
  const user = await getUser(request)
  return user ? { user } : { response: fail(401, 'Sign in to continue.') }
}
