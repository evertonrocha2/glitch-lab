const KEY = 'gd:dev-user'

// Local development only: no passwords, the "account" lives in localStorage and the token is "dev:<id>".
export function createDevAuth() {
  const listeners = new Set()

  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY))
    } catch {
      return null
    }
  }

  function write(user) {
    try {
      if (user) localStorage.setItem(KEY, JSON.stringify(user))
      else localStorage.removeItem(KEY)
    } catch {
      // Storage blocked: the session just won't survive a reload.
    }
    for (const listener of listeners) listener(user)
  }

  const signInAs = async (id) => write({ id, email: `${id}@dev.local` })

  return {
    mode: 'dev',
    currentUser: read,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async getToken() {
      const user = read()
      return user ? `dev:${user.id}` : null
    },
    signInDev: () => signInAs('student'),
    signInDemo: () => signInAs('demo'),
    async signOut() {
      write(null)
    },
  }
}
