import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createDevAuth } from './devAuth.js'
import { createSupabaseAuth } from './supabaseAuth.js'

const AuthContext = createContext(null)

// Supabase when the project is configured; otherwise the local dev login.
const auth = import.meta.env.VITE_SUPABASE_URL ? createSupabaseAuth() : createDevAuth()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => auth.currentUser())
  const [ready, setReady] = useState(auth.mode === 'dev')

  useEffect(
    () =>
      auth.subscribe((next) => {
        setUser(next)
        setReady(true)
      }),
    [],
  )

  const value = useMemo(() => ({ ...auth, user, ready }), [user, ready])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// { user, ready, mode, getToken, signInDev?, signInDemo, signInWithGitHub?, signInWithPassword?, signUp?, signOut }
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
