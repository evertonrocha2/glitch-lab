import { Link, NavLink } from 'react-router'
import { useAuth } from '../../../lib/auth/auth-provider.jsx'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import PixelLogo, { Wordmark } from '../../ui/pixel-logo/pixel-logo.jsx'
import LanguageSelect from '../../ui/language-select/language-select.jsx'

export function TryLink() {
  const t = useT()
  return (
    <PixelButton as={Link} to="/" className="px-3 py-2">
      {t('landing.public.try')}
    </PixelButton>
  )
}

const peopleClass = ({ isActive }) =>
  `border-b-2 py-1.5 font-mono text-[13px] uppercase tracking-[0.06em] transition-colors ${isActive ? 'border-gold text-ink' : 'border-transparent text-muted hover:text-ink'}`

// Top bar for the pages anyone can open signed out: public profiles, shared notes and the people search.
export default function PublicHeader({ showTry = true }) {
  // Signed in, these pages are a detour from the app: offer the way back instead of a sign-up pitch.
  const { user } = useAuth()
  const t = useT()
  return (
    <header className="border-b border-arcane-hi/15 bg-[#0c081a]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-3.5 sm:px-8">
        <Link to="/" className="flex items-center gap-2 whitespace-nowrap font-pixel text-lg text-ink sm:gap-2.5 sm:text-[22px]">
          <PixelLogo className="size-7 sm:size-8" />
          <Wordmark />
        </Link>
        <div className="flex items-center gap-4 sm:gap-5">
          <NavLink to="/people" end className={peopleClass}>
            {t('landing.public.people')}
          </NavLink>
          <LanguageSelect compact />
          {user ? (
            <PixelButton as={Link} to="/board" className="px-3 py-2">
              {t('landing.public.back')}
            </PixelButton>
          ) : (
            showTry && <TryLink />
          )}
        </div>
      </div>
    </header>
  )
}
