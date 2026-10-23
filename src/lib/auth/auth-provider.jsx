import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createSessionAuth } from './session.js'

const AuthContext = createContext(null)

const auth = createSessionAuth()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => auth.currentUser())

  useEffect(() => auth.subscribe(setUser), [])

  const value = useMemo(() => ({ ...auth, user }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// { user, getToken, signInWithPassword, signUp, signInDemo, signOut }
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
