import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import PixelBug from '../components/pixel/PixelBug.jsx'
import PixelButton from '../components/pixel/PixelButton.jsx'
import PixelCard from '../components/pixel/PixelCard.jsx'
import PixelLogo from '../components/pixel/PixelLogo.jsx'
import { useAuth } from '../lib/auth/AuthProvider.jsx'

// Only paths inside this site: "//evil.example" would leave it.
function safeNext(next) {
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/board'
}

const fieldClass =
  'mt-2 w-full border-2 border-ink bg-white px-3 py-2.5 text-ink transition-shadow duration-150 focus:shadow-pixel focus-visible:outline-none'

function PasswordForm({ auth, run, busy }) {
  const [creating, setCreating] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    run(() => (creating ? auth.signUp(email, password) : auth.signInWithPassword(email, password)))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="login-email" className="font-label text-xs text-ink">
          Email
        </label>
        <input id="login-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
      </div>
      <div>
        <label htmlFor="login-password" className="font-label text-xs text-ink">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          required
          minLength={6}
          autoComplete={creating ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={fieldClass}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <PixelButton type="submit" disabled={busy}>
          {creating ? 'Create account' : 'Sign in'}
        </PixelButton>
        <button type="button" onClick={() => setCreating(!creating)} className="text-sm text-muted underline underline-offset-4 hover:text-ink">
          {creating ? 'I already have an account' : 'Create an account'}
        </button>
      </div>
    </form>
  )
}

export default function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (auth.user) navigate(next, { replace: true })
  }, [auth.user, next, navigate])

  async function run(action) {
    setBusy(true)
    setMessage('')
    try {
      await action()
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-mist">
      <header className="border-b-2 border-ink bg-white">
        <div className="mx-auto flex max-w-6xl items-center px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 font-pixel text-xl font-bold text-ink">
            <PixelLogo className="size-7" />
            <span>Glitch Detective</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:py-20">
        <div>
          <p className="font-label text-[11px] text-secondary">
            &gt; login_<span className="motion-safe:animate-caret">█</span>
          </p>
          <h1 className="mt-4 font-pixel text-4xl font-bold leading-tight text-ink sm:text-5xl">Sign in to your case board</h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            Your board keeps every error you investigate, with the why and the fix, so you can study it and train on it in the gym.
          </p>
          <div aria-hidden="true" className="relative mt-10 hidden h-44 max-w-md overflow-hidden border-2 border-ink bg-white shadow-pixel-ink lg:block">
            <div className="dither-primary absolute inset-0 opacity-50" />
            <div className="dither-secondary absolute inset-0 opacity-45" />
            <div className="absolute inset-0 grid place-items-center">
              <PixelBug className="h-24 w-auto motion-safe:animate-glitch" />
            </div>
          </div>
        </div>

        <PixelCard className="p-6 sm:p-8">
          {auth.mode === 'dev' ? (
            <div className="space-y-5">
              <p className="font-label text-[11px] text-primary">Dev mode</p>
              <p className="text-muted">No real accounts on this machine yet. Pick one to try the app.</p>
              <div className="flex flex-wrap gap-3">
                <PixelButton onClick={() => run(auth.signInDev)} disabled={busy}>
                  Dev login
                </PixelButton>
                <PixelButton variant="secondary" onClick={() => run(auth.signInDemo)} disabled={busy}>
                  Use demo account
                </PixelButton>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <PixelButton onClick={() => run(() => auth.signInWithGitHub(next))} disabled={busy} className="w-full py-3">
                Continue with GitHub
              </PixelButton>
              <p className="flex items-center gap-3 font-label text-[10px] text-muted">
                <span className="h-0.5 flex-1 bg-line" /> or <span className="h-0.5 flex-1 bg-line" />
              </p>
              <PasswordForm auth={auth} run={run} busy={busy} />
              <div className="border-t-2 border-dashed border-line pt-5">
                <p className="mb-3 text-sm text-muted">Judging or just curious? Skip the sign up.</p>
                <PixelButton variant="secondary" onClick={() => run(auth.signInDemo)} disabled={busy}>
                  Use demo account
                </PixelButton>
              </div>
            </div>
          )}
          {message && (
            <p role="alert" className="mt-5 border-2 border-ink bg-primary-soft p-3 text-sm text-ink">
              {message}
            </p>
          )}
        </PixelCard>
      </main>
    </div>
  )
}
