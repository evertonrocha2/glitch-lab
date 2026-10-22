import * as community from '../../api/community.js'
import { apiRequest } from './helpers.js'

// Calls /api/community?resource=<resource>&<query> the way the browser would.
// token: 'dev:<id>' signs in as that user, null sends no Authorization header.
export async function call(method, resource, { query = '', body, token = null } = {}) {
  const url = `/api/community?resource=${resource}${query ? `&${query}` : ''}`
  const res = await community[method](apiRequest(url, { method, body, token }))
  return { status: res.status, body: await res.json(), headers: res.headers }
}

// A real account with a profile, plus its dev token.
export async function makeUser(store, name, { isDemo = false, profile = {} } = {}) {
  const user = await store.createUser({ email: `${name}@example.com`, passwordHash: null, isDemo })
  if (Object.keys(profile).length) await store.updateProfile(user.id, profile)
  return { ...user, token: `dev:${user.id}` }
}

export const ARTICLE = {
  title: 'Undefined everywhere',
  body: 'Reading a property of undefined throws.\n\nUse `a?.b` when a may be missing:\n\n```js\nconst name = user?.name\n```',
  tags: ['javascript', 'undefined'],
}
