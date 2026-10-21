import { Link } from 'react-router'
import { useAuth } from '../../lib/auth/AuthProvider.jsx'
import PixelButton from '../pixel/PixelButton.jsx'
import PixelLogo from '../pixel/PixelLogo.jsx'

const navLinkClass = 'font-label text-[11px] text-ink transition-colors hover:text-primary'

export default function SiteHeader() {
  const { user } = useAuth()
  return (
    <header className="border-b-2 border-ink bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5 font-pixel text-xl font-bold text-ink">
          <PixelLogo className="size-7" />
          <span>Glitch Detective</span>
        </a>
        <nav aria-label="Main" className="flex items-center gap-5 sm:gap-6">
          <a href="#how" className={`hidden sm:inline ${navLinkClass}`}>
            How it works
          </a>
          {user ? (
            <Link to="/board" className={navLinkClass}>
              My board
            </Link>
          ) : (
            <Link to="/login" className={navLinkClass}>
              Sign in
            </Link>
          )}
          <PixelButton as="a" href="#try" className="px-3 py-2">
            Try it
          </PixelButton>
        </nav>
      </div>
    </header>
  )
}
