import { verifyToken } from './auth/session.js'

function bearerToken(request) {
  const header = request.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
}

// Returns { id, email, isDemo } for a valid signed session, or null.
export async function getUser(request) {
  const token = bearerToken(request)
  return token ? verifyToken(token) : null
}
