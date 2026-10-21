import { signIn, signUp, startDemo } from '../api.js'

const KEY = 'gd:session'

// The server signs the token; the browser only keeps it. Its middle part says when it expires.
function expired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' && payload.exp <= Date.now()
  } catch {
    return false
  }
}

// { token, user } in localStorage, so a reload keeps you signed in until the token runs out.
export function createSessionAuth() {
  const listeners = new Set()

  function read() {
    try {
      const session = JSON.parse(localStorage.getItem(KEY))
      return session?.token && session.user && !expired(session.token) ? session : null
    } catch {
      return null
    }
  }

  function write(session) {
    try {
      if (session) localStorage.setItem(KEY, JSON.stringify(session))
      else localStorage.removeItem(KEY)
    } catch {
      // Storage blocked: the session just won't survive a reload.
    }
    for (const listener of listeners) listener(session?.user ?? null)
  }

  return {
    currentUser: () => read()?.user ?? null,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async getToken() {
      return read()?.token ?? null
    },
    signInWithPassword: async (email, password) => write(await signIn({ email, password })),
    signUp: async (email, password) => write(await signUp({ email, password })),
    signInDemo: async () => write(await startDemo()),
    async signOut() {
      write(null)
    },
  }
}
