import { memo } from 'react'
import { Link, useLocation } from 'react-router'
import { isEmbedded } from '../../../app/embed.js'
import { useAuth } from '../../../lib/auth/auth-provider.jsx'
import { useUnreadMessages } from '../../../lib/chat/unread.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useMyProfile } from '../../../lib/profile/my-profile.js'
import { useProgressData } from '../../../lib/progress/progress-provider.jsx'
import AssistantPanel, { AssistantButton } from '../../assistant/assistant-panel/assistant-panel.jsx'
import BadgeToasts from '../badge-toasts/badge-toasts.jsx'
import MessageToasts from '../message-toasts/message-toasts.jsx'
import LanguageSelect from '../../ui/language-select/language-select.jsx'
import CommunityIcon from '../../community/community-icon/community-icon.jsx'
import NotificationBell from '../../community/notification-bell/notification-bell.jsx'
import PixelAvatar from '../../ui/pixel-avatar/pixel-avatar.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import PixelLogo from '../../ui/pixel-logo/pixel-logo.jsx'
import StudyTimer from '../study-timer/study-timer.jsx'
import AppNav from '../app-nav/app-nav.jsx'

// The width every row of the signed-in pages shares: the header's two rows and the page.
const COLUMN = 'mx-auto max-w-[120rem] px-5 sm:px-8 lg:px-12'

// Top bar for the signed-in pages, plus the study timer, message and badge toasts and the assistant.
// The bar and the corner widgets take no props and are memoized: a page re-rendering its own
// content (opening a drawer, typing) doesn't redraw them.
// The bar and the page run close to the screen's edges, with a side margin; ultra-wide screens stop at 120rem.
// Inside the game's study window (embed mode, src/app/embed.js) the page shows alone.
export default function AppShell({ children }) {
  const { search } = useLocation()
  if (isEmbedded(search)) {
    return (
      <div className="min-h-screen bg-mist">
        <main className="px-3 pt-4 pb-10 sm:px-5">{children}</main>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-mist">
      <AppHeader />
      <main className={`${COLUMN} pt-10 pb-28 sm:pt-14`}>
        {children}
      </main>
      <ShellWidgets />
    </div>
  )
}

const ShellWidgets = memo(function ShellWidgets() {
  return (
    <>
      <StudyTimer />
      {/* Message and badge toasts share the corner, in one stack. Empty, it lets clicks through. */}
      <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex w-[calc(100vw-2rem)] max-w-80 flex-col gap-3">
        <MessageToasts />
        <BadgeToasts />
      </div>
      <AssistantPanel />
    </>
  )
})

const AppHeader = memo(function AppHeader() {
  const { signOut } = useAuth()
  const progress = useProgressData()
  const avatar = useMyProfile()?.profile.avatar
  const unread = useUnreadMessages()
  const t = useT()
  return (
    <header className="border-b-2 border-ink bg-white">
      {/* Top row: the brand on the left; the language, the assistant, notifications and your account on the right. */}
      <div className={`${COLUMN} flex items-center justify-between gap-2 py-3 sm:gap-3`}>
        <Link to="/" className="flex min-w-0 items-center gap-1.5 whitespace-nowrap font-pixel text-base font-bold text-ink sm:gap-2.5 sm:text-xl">
          <PixelLogo className="size-5 shrink-0 sm:size-7" />
          {/* On narrow phones the right side fills the row, so only the logo shows; the name stays for screen readers. */}
          <span className="sr-only min-[440px]:not-sr-only min-[440px]:truncate">StudyQuest</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <LanguageSelect compact className="shrink-0" />
          <AssistantButton />
          <NotificationBell />
          <Link to="/profile" aria-label={t('app.shell.profile')} className="flex shrink-0 transition-transform hover:-translate-y-0.5">
            {avatar ? (
              <PixelAvatar seed={avatar.seed} color={avatar.color} className="size-10" />
            ) : (
              <span aria-hidden="true" className="block size-10 border-2 border-ink bg-line motion-safe:animate-skeleton" />
            )}
          </Link>
          {/* Phones show just an exit icon; the name stays "Sign out". */}
          <PixelButton variant="ghost" onClick={signOut} aria-label={t('app.shell.signOut')} className="min-w-10 px-1.5 py-1.5 sm:px-3 sm:py-2">
            <CommunityIcon name="exit" className="size-4 sm:hidden" />
            <span className="hidden sm:inline">{t('app.shell.signOut')}</span>
          </PixelButton>
        </div>
      </div>
      {/* Second row: the pages, on one line; the ones that don't fit go in a "More" menu. */}
      <div className="border-t-2 border-dashed border-line">
        <div className={`${COLUMN} flex items-center`}>
          <AppNav level={progress?.level ?? null} unread={unread} />
        </div>
      </div>
    </header>
  )
})
