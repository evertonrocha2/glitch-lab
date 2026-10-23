import { Link, useLocation } from 'react-router'
import { useAuth } from '../../lib/auth/AuthProvider.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import AppShell from '../AppShell.jsx'
import LanguageSelect from '../LanguageSelect.jsx'
import PixelButton from '../pixel/PixelButton.jsx'
import PixelLogo from '../pixel/PixelLogo.jsx'

// The articles pages are public: signed in they sit in the app, signed out under a light header.
export default function CommunityShell({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  const t = useT()
  if (user) return <AppShell>{children}</AppShell>
  const next = encodeURIComponent(location.pathname + location.search)
  return (
    <div className="min-h-screen bg-mist">
      <header className="border-b-2 border-ink bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2 whitespace-nowrap font-pixel text-lg font-bold text-ink sm:gap-2.5 sm:text-xl">
            <PixelLogo className="size-6 sm:size-7" />
            <span>Glitch Lab</span>
          </Link>
          <nav aria-label={t('notes.articles.nav')} className="flex items-center gap-2 sm:gap-4">
            <Link to="/articles" className="hidden font-label text-xs text-ink hover:text-primary sm:inline">
              {t('notes.articles.title')}
            </Link>
            <Link to="/events" className="hidden font-label text-xs text-ink hover:text-primary sm:inline">
              {t('events.nav')}
            </Link>
            <LanguageSelect compact />
            <PixelButton as={Link} to={`/login?next=${next}`} className="px-3 py-2">
              {t('notes.articles.signIn')}
            </PixelButton>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pt-10 pb-20 sm:px-8 sm:pt-14">{children}</main>
    </div>
  )
}
