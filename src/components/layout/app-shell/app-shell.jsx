import { Link, NavLink } from 'react-router'
import { useAuth } from '../../../lib/auth/AuthProvider.jsx'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useMyProfile } from '../../../lib/profile/myProfile.js'
import { useProgress } from '../../../lib/progress/ProgressProvider.jsx'
import AssistantPanel, { AssistantButton } from '../../assistant/assistant-panel/assistant-panel.jsx'
import BadgeToasts from '../badge-toasts/badge-toasts.jsx'
import LanguageSelect from '../../ui/language-select/language-select.jsx'
import CommunityIcon from '../../community/community-icon/community-icon.jsx'
import NotificationBell from '../../community/notification-bell/notification-bell.jsx'
import PixelAvatar from '../../ui/pixel-avatar/pixel-avatar.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import PixelLogo from '../../ui/pixel-logo/pixel-logo.jsx'
import StudyTimer from '../study-timer/study-timer.jsx'

const navClass = ({ isActive }) =>
  `relative flex shrink-0 items-center gap-1.5 border-b-2 py-1 font-label text-xs transition-colors before:absolute before:inset-x-0 before:-inset-y-2 sm:text-xs ${
    isActive ? 'border-primary text-primary' : 'border-transparent text-ink hover:text-primary'
  }`

// Top bar for the signed-in pages, plus the study timer, badge announcements and the assistant.
export default function AppShell({ children }) {
  const { signOut } = useAuth()
  const { progress } = useProgress()
  const avatar = useMyProfile()?.profile.avatar
  const t = useT()
  return (
    <div className="min-h-screen bg-mist">
      <header className="border-b-2 border-ink bg-white">
        {/* Top row: the brand on the left, everything about you on the right. */}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-5 py-3 sm:gap-3 sm:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-1.5 whitespace-nowrap font-pixel text-base font-bold text-ink sm:gap-2.5 sm:text-xl">
            <PixelLogo className="size-5 shrink-0 sm:size-7" />
            <span className="truncate">Glitch Lab</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <AssistantButton />
            <NotificationBell />
            <Link to="/profile" aria-label={t('app.shell.profile')} className="block shrink-0 transition-transform hover:-translate-y-0.5">
              {avatar ? (
                <PixelAvatar seed={avatar.seed} color={avatar.color} className="size-10" />
              ) : (
                <span aria-hidden="true" className="block size-10 border-2 border-ink bg-mist" />
              )}
            </Link>
            {/* Phones show just an exit icon; the name stays "Sign out". */}
            <PixelButton variant="ghost" onClick={signOut} aria-label={t('app.shell.signOut')} className="min-w-10 px-1.5 py-1.5 sm:px-3 sm:py-2">
              <CommunityIcon name="exit" className="size-4 sm:hidden" />
              <span className="hidden sm:inline">{t('app.shell.signOut')}</span>
            </PixelButton>
          </div>
        </div>
        {/* Second row: the pages, then the language. The pages stay on one line; on narrow phones they
            scroll sideways while the language picker stays put at the end. */}
        <div className="border-t-2 border-dashed border-line">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 sm:px-8">
            <div className="relative min-w-0 flex-1">
              <nav aria-label={t('app.nav.main')} className="flex items-center gap-4 overflow-x-auto py-2 pr-6 whitespace-nowrap sm:gap-7 sm:pr-0">
              <NavLink to="/board" className={navClass}>
                {t('app.nav.board')}
              </NavLink>
              <NavLink to="/daily" className={navClass}>
                {t('app.nav.daily')}
              </NavLink>
              <NavLink to="/glitchdle" className={navClass}>
                {t('app.nav.glitchdle')}
              </NavLink>
              <NavLink to="/duel" className={navClass}>
                {t('duel.nav')}
              </NavLink>
              <NavLink to="/notes" className={navClass}>
                {t('app.nav.notes')}
              </NavLink>
              <NavLink to="/trail" className={navClass}>
                {t('app.nav.trail')}
              </NavLink>
              <NavLink to="/articles" className={navClass}>
                {t('app.nav.articles')}
              </NavLink>
              <NavLink to="/events" className={navClass}>
                {t('events.nav')}
              </NavLink>
              <NavLink to="/progress" className={navClass}>
                {t('app.nav.progress')}{' '}
                {progress && (
                  <>
                    <span aria-hidden="true" className="bg-secondary px-1 py-0.5 text-[10px] leading-none text-white">
                      {t('app.nav.levelChip', { level: progress.level })}
                    </span>
                    <span className="sr-only">{t('app.nav.levelSr', { level: progress.level })}</span>
                  </>
                )}
              </NavLink>
              </nav>
              {/* A fade at the edge says "there's more" when the row scrolls on a phone. */}
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-white to-transparent sm:hidden" />
            </div>
            <LanguageSelect compact className="shrink-0" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pt-10 pb-28 sm:px-8 sm:pt-14">{children}</main>
      <StudyTimer />
      <BadgeToasts />
      <AssistantPanel />
    </div>
  )
}
