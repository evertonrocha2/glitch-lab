import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import PixelBug from '../../components/ui/pixel-bug/pixel-bug.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import LanguageSelect from '../../components/ui/language-select/language-select.jsx'
import PixelLogo from '../../components/ui/pixel-logo/pixel-logo.jsx'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import DemoLogin from './demo-login.jsx'

// Only paths inside this site: "//evil.example" would leave it.
function safeNext(next) {
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/board'
}

const fieldClass =
  'mt-2 w-full border-2 border-ink bg-white px-3 py-2.5 text-ink transition-shadow duration-150 focus:shadow-pixel focus-visible:outline-none'

// startCreating: opened from a "Create account" link (?mode=signup), so the form starts on sign up.
function PasswordForm({ auth, run, busy, startCreating }) {
  const t = useT()
  const [creating, setCreating] = useState(startCreating)
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
          {t('landing.login.email')}
        </label>
        <input id="login-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
      </div>
      <div>
        <label htmlFor="login-password" className="font-label text-xs text-ink">
          {t('landing.login.password')}
        </label>
        <input
          id="login-password"
          type="password"
          required
          minLength={8}
          autoComplete={creating ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby={creating ? 'login-password-rule' : undefined}
          className={fieldClass}
        />
        {creating && (
          <p id="login-password-rule" className="mt-1.5 text-xs text-muted">
            {t('landing.login.passwordRule')}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <PixelButton type="submit" disabled={busy}>
          {t(creating ? 'landing.login.create' : 'landing.login.signIn')}
        </PixelButton>
        <button type="button" onClick={() => setCreating(!creating)} className="text-sm text-muted underline underline-offset-4 hover:text-ink">
          {t(creating ? 'landing.login.haveAccount' : 'landing.login.wantAccount')}
        </button>
      </div>
    </form>
  )
}

export default function LoginPage() {
  const auth = useAuth()
  const t = useT()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const signingUp = params.get('mode') === 'signup'
  // The one-click demo account is for local development, or a build made with VITE_DEMO_LOGIN=1 (the API
  // answers 404 on a deployed server). Written out here, read on each render so tests can stub it: a
  // production build turns it into `false` and drops the button and its copy from the bundle.
  const demoLogin = import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGIN === '1'
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 font-pixel text-xl font-bold text-ink">
            <PixelLogo className="size-7" />
            <span>Glitch Lab</span>
          </Link>
          <LanguageSelect compact />
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:py-20">
        <div>
          <p className="font-label text-xs text-secondary">
            &gt; login_<span className="motion-safe:animate-caret">█</span>
          </p>
          <h1 className="mt-4 font-pixel text-4xl font-bold leading-tight text-ink sm:text-5xl">{t('landing.login.title')}</h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            {t('landing.login.body')}
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
          <div className="space-y-6">
            <PasswordForm auth={auth} run={run} busy={busy} startCreating={signingUp} />
            {demoLogin && <DemoLogin onClick={() => run(auth.signInDemo)} disabled={busy} />}
          </div>
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
