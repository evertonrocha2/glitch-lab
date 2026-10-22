import { Link, NavLink } from 'react-router'
import { useAuth } from '../lib/auth/AuthProvider.jsx'
import { useMyProfile } from '../lib/profile/myProfile.js'
import { useProgress } from '../lib/progress/ProgressProvider.jsx'
import BadgeToasts from './BadgeToasts.jsx'
import PixelAvatar from './pixel/PixelAvatar.jsx'
import PixelButton from './pixel/PixelButton.jsx'
import PixelLogo from './pixel/PixelLogo.jsx'
import StudyTimer from './StudyTimer.jsx'

const navClass = ({ isActive }) =>
  `flex items-center gap-1.5 border-b-2 py-1 font-label text-xs transition-colors ${
    isActive ? 'border-primary text-primary' : 'border-transparent text-ink hover:text-primary'
  }`

// Top bar for the signed-in pages, plus the study timer and badge announcements.
export default function AppShell({ children }) {
  const { signOut } = useAuth()
  const { progress } = useProgress()
  const avatar = useMyProfile()?.profile.avatar
  return (
    <div className="min-h-screen bg-mist">
      <header className="border-b-2 border-ink bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2 whitespace-nowrap font-pixel text-lg font-bold text-ink sm:gap-2.5 sm:text-xl">
            <PixelLogo className="size-6 sm:size-7" />
            <span>Glitch Detective</span>
          </Link>
          <div className="flex items-center gap-3 sm:order-last sm:gap-4">
            <Link to="/profile" aria-label="Your profile" className="block transition-transform hover:-translate-y-0.5">
              {avatar ? (
                <PixelAvatar seed={avatar.seed} color={avatar.color} className="size-9" />
              ) : (
                <span aria-hidden="true" className="block size-9 border-2 border-ink bg-mist" />
              )}
            </Link>
            <PixelButton variant="ghost" onClick={signOut} className="px-2.5 py-2 sm:px-3">
              Sign out
            </PixelButton>
          </div>
          <nav aria-label="Main" className="flex w-full items-center gap-5 sm:ml-auto sm:w-auto">
            <NavLink to="/board" className={navClass}>
              Board
            </NavLink>
            <NavLink to="/notes" className={navClass}>
              Notes
            </NavLink>
            <NavLink to="/progress" className={navClass}>
              Progress{' '}
              {progress && (
                <>
                  <span aria-hidden="true" className="bg-secondary px-1 py-0.5 text-[10px] leading-none text-white">
                    Lv {progress.level}
                  </span>
                  <span className="sr-only">(level {progress.level})</span>
                </>
              )}
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pt-10 pb-28 sm:px-8 sm:pt-14">{children}</main>
      <StudyTimer />
      <BadgeToasts />
    </div>
  )
}
