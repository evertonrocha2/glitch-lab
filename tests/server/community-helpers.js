import { api } from './helpers.js'

// Calls a community route (/api/articles, /api/events, ...) the way the browser would.
// token: 'dev:<id>' signs in as that user, null (the default) sends no Authorization header.
export async function call(method, path, { body, token = null } = {}) {
  const res = await api(path, { method, body, token })
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
