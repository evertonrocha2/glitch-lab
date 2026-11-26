import { Link } from 'react-router'
import { useAuth } from '../../../lib/auth/auth-provider.jsx'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import LanguageSelect from '../../ui/language-select/language-select.jsx'
import PixelLogo from '../../ui/pixel-logo/pixel-logo.jsx'
import { WRAP } from '../section-head/section-head.jsx'

const navLink =
  'block whitespace-nowrap border-b-2 border-transparent px-2.5 py-2 font-mono text-[13px] uppercase tracking-[0.06em] text-(--lp-muted) transition-colors hover:border-(--lp-gold) hover:text-(--lp-text)'

// The wordmark: "Study" in the text color, "Quest" in gold.
export function Wordmark({ className = 'text-[22px]' }) {
  return (
    <span className={`font-pixel leading-none text-(--lp-text) ${className}`}>
      Study<span className="text-(--lp-gold)">Quest</span>
    </span>
  )
}

// Sticky over the hero, glassy, so the névoa shows through as you scroll.
export default function SiteHeader() {
  const { user } = useAuth()
  const t = useT()
  return (
    <header className="sticky top-0 z-50 border-b border-[rgb(195_166_255/0.12)] bg-[rgb(12_8_26/0.62)] backdrop-blur-md">
      <div className={`${WRAP} flex h-[60px] items-center gap-3 sm:h-[68px] sm:gap-7`}>
        <a href="#top" aria-label={t('landing.nav.home')} className="flex shrink-0 items-center gap-2.5">
          <PixelLogo className="size-7 sm:size-8" />
          <Wordmark className="text-lg sm:text-[22px]" />
        </a>
        <nav aria-label={t('landing.nav.label')} className="ml-auto flex items-center gap-2 sm:gap-3 lg:ml-0 lg:flex-1">
          <ul className="mr-auto hidden items-center gap-1 lg:flex">
            <li>
              <a href="#modes" className={navLink}>
                {t('landing.nav.modes')}
              </a>
            </li>
            <li>
              <a href="#how" className={navLink}>
                {t('landing.nav.how')}
              </a>
            </li>
            <li>
              <a href="#quests" className={navLink}>
                {t('landing.nav.quests')}
              </a>
            </li>
            <li>
              <a href="#faq" className={navLink}>
                {t('landing.nav.faq')}
              </a>
            </li>
            <li>
              <Link to="/articles" className={navLink}>
                {t('landing.nav.articles')}
              </Link>
            </li>
          </ul>
          {user ? (
            <Link to="/board" className={navLink}>
              {t('landing.nav.board')}
            </Link>
          ) : (
            <Link to="/login" className={navLink}>
              {t('landing.nav.signIn')}
            </Link>
          )}
          <LanguageSelect compact className="lp-lang" />
          {!user && (
            <Link to="/login?mode=signup" className="lp-btn lp-btn-gold lp-btn-sm hidden sm:inline-flex">
              {t('landing.nav.signUp')}
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
