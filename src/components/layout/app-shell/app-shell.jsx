import { memo, useEffect } from 'react'
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
import PixelLogo, { Wordmark } from '../../ui/pixel-logo/pixel-logo.jsx'
import StudyTimer from '../study-timer/study-timer.jsx'
import AppNav from '../app-nav/app-nav.jsx'
import { prefetchWorld } from '../../world/world-prefetch.js'

// The width every row of the signed-in pages shares: the header's two rows and the page.
const COLUMN = 'mx-auto max-w-[88rem] px-5 sm:px-10 lg:px-16'

// Top bar for the signed-in pages, plus the study timer, message and badge toasts and the assistant.
// The bar and the corner widgets take no props and are memoized: a page re-rendering its own
// content (opening a drawer, typing) doesn't redraw them.
// The bar and the page share one centered column with roomy side margins; wide screens stop at 88rem.
// Inside the game's study window (embed mode, src/app/embed.js) the page shows alone.
export default function AppShell({ children }) {
  const { search } = useLocation()
  const embedded = isEmbedded(search)
  useWorldPrefetch(!embedded)
  if (embedded) {
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

// Starts loading the world page's first data (where the hero stands, the game View) once signed in, so
// /mundo opens without waiting (world-prefetch.js). Inside the game's study window the world is open.
function useWorldPrefetch(enabled) {
  const { user, getToken } = useAuth()
  const id = user?.id ?? null
  useEffect(() => {
    if (!enabled || !id || globalThis.navigator?.connection?.saveData) return
    try {
      prefetchWorld(id, getToken)
    } catch {
      // A prefetch is a bonus: the world page loads its own.
    }
  }, [enabled, id, getToken])
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

// The level chip (the spike's): your avatar, the level in gold and a thin XP bar toward the next one.
// It leads to your profile; its name stays "Your profile" for screen readers.
function LevelChip({ avatar, progress }) {
  const t = useT()
  const share = progress?.nextLevelXp ? Math.min(1, Math.max(0, (progress.xp - progress.levelXp) / (progress.nextLevelXp - progress.levelXp))) : progress ? 1 : 0
  return (
    <Link
      to="/profile"
      aria-label={t('app.shell.profile')}
      className="kit-inset flex shrink-0 items-center gap-2.5 p-1 transition-transform hover:-translate-y-0.5 sm:pr-2.5"
    >
      {avatar ? (
        <PixelAvatar seed={avatar.seed} color={avatar.color} className="size-8" />
      ) : (
        <span aria-hidden="true" className="block size-8 border-2 border-ink bg-line motion-safe:animate-skeleton" />
      )}
      <span aria-hidden="true" className="hidden gap-1.5 sm:grid">
        <span className="font-pixel text-xs leading-none text-gold">{progress ? t('app.nav.levelChip', { level: progress.level }) : ' '}</span>
        <span className="block h-[5px] w-[72px] bg-void shadow-[0_0_0_1px_#363e4c]">
          <span className="block h-full bg-linear-to-r from-arcane to-arcane-hi" style={{ width: `${Math.round(share * 100)}%` }} />
        </span>
      </span>
    </Link>
  )
}

const AppHeader = memo(function AppHeader() {
  const { signOut } = useAuth()
  const progress = useProgressData()
  const avatar = useMyProfile()?.profile.avatar
  const unread = useUnreadMessages()
  const t = useT()
  return (
    <header className="border-b border-arcane-hi/15 bg-[#14171d]">
      {/* Top row: the brand on the left; the language, the assistant, notifications and your account on the right. */}
      <div className={`${COLUMN} flex items-center justify-between gap-2 py-3 sm:gap-3`}>
        <Link to="/" className="flex min-w-0 items-center gap-2 whitespace-nowrap font-pixel text-lg text-ink sm:gap-2.5 sm:text-[22px]">
          <PixelLogo className="size-7 shrink-0 sm:size-8" />
          {/* On narrow phones the right side fills the row, so only the logo shows; the name stays for screen readers. */}
          <Wordmark className="sr-only min-[440px]:not-sr-only min-[440px]:truncate" />
        </Link>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <LanguageSelect compact className="shrink-0" />
          <AssistantButton />
          <NotificationBell />
          <LevelChip avatar={avatar} progress={progress} />
          {/* Phones show just an exit icon; the name stays "Sign out". */}
          <PixelButton variant="ghost" onClick={signOut} aria-label={t('app.shell.signOut')} className="min-w-10 px-1.5 py-1.5 sm:px-3 sm:py-2">
            <CommunityIcon name="exit" className="size-4 sm:hidden" />
            <span className="hidden sm:inline">{t('app.shell.signOut')}</span>
          </PixelButton>
        </div>
      </div>
      {/* Second row: the pages, on one line; the ones that don't fit go in a "More" menu. */}
      <div className="border-t border-arcane-hi/10">
        <div className={`${COLUMN} flex items-center`}>
          <AppNav level={progress?.level ?? null} unread={unread} />
        </div>
      </div>
    </header>
  )
})
