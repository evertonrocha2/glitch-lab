import { createClient } from '@supabase/supabase-js'

// Production login. The browser only holds the public anon key; the API checks every token server-side.
export function createSupabaseAuth() {
  const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  const toUser = (session) => (session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null)

  function orThrow({ error }) {
    if (error) throw new Error(error.message)
  }

  return {
    mode: 'supabase',
    // Unknown until the stored session loads; subscribe() reports it.
    currentUser: () => null,
    subscribe(listener) {
      supabase.auth.getSession().then(({ data }) => listener(toUser(data.session)))
      const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(toUser(session)))
      return () => data.subscription.unsubscribe()
    },
    async getToken() {
      const { data } = await supabase.auth.getSession()
      return data.session?.access_token ?? null
    },
    async signInWithGitHub(next = '/board') {
      orThrow(
        await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: `${window.location.origin}${next}` } }),
      )
    },
    async signInWithPassword(email, password) {
      orThrow(await supabase.auth.signInWithPassword({ email, password }))
    },
    // If email confirmation is on in Supabase there is no session yet: say so instead of doing nothing.
    async signUp(email, password) {
      const result = await supabase.auth.signUp({ email, password })
      orThrow(result)
      if (!result.data.session) throw new Error('Check your email to confirm your account, then sign in.')
    },
    // Each visitor gets their own anonymous account; the API seeds its sample board on first load.
    // No shared password means nobody can lock judges out of the demo.
    async signInDemo() {
      orThrow(await supabase.auth.signInAnonymously())
    },
    async signOut() {
      await supabase.auth.signOut()
    },
  }
}
