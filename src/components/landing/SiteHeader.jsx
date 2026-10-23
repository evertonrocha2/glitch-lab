import { Link } from 'react-router'
import { useAuth } from '../../lib/auth/AuthProvider.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../pixel/PixelButton.jsx'
import PixelLogo from '../pixel/PixelLogo.jsx'
import LanguageSelect from '../LanguageSelect.jsx'

const navLinkClass = 'whitespace-nowrap font-label text-xs text-ink transition-colors hover:text-primary'

export default function SiteHeader() {
  const { user } = useAuth()
  const t = useT()
  return (
    <header className="border-b-2 border-ink bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <a href="#top" className="flex items-center gap-2 whitespace-nowrap font-pixel text-lg font-bold text-ink sm:gap-2.5 sm:text-xl">
          <PixelLogo className="size-6 sm:size-7" />
          <span>Glitch Lab</span>
        </a>
        <nav aria-label={t('landing.nav.label')} className="flex items-center gap-4 sm:gap-6">
          <a href="#how" className={`hidden md:inline ${navLinkClass}`}>
            {t('landing.nav.how')}
          </a>
          <a href="#features" className={`hidden md:inline ${navLinkClass}`}>
            {t('landing.nav.features')}
          </a>
          <a href="#faq" className={`hidden md:inline ${navLinkClass}`}>
            {t('landing.nav.faq')}
          </a>
          <Link to="/articles" className={`hidden sm:inline ${navLinkClass}`}>
            {t('landing.nav.articles')}
          </Link>
          {user ? (
            <Link to="/board" className={navLinkClass}>
              {t('landing.nav.board')}
            </Link>
          ) : (
            <Link to="/login" className={navLinkClass}>
              {t('landing.nav.signIn')}
            </Link>
          )}
          <LanguageSelect compact />
          <PixelButton as="a" href="#try" className="hidden whitespace-nowrap px-3 py-2 sm:inline-flex">
            {t('landing.nav.try')}
          </PixelButton>
        </nav>
      </div>
    </header>
  )
}
