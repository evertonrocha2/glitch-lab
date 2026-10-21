import { Link } from 'react-router'
import { useAuth } from '../lib/auth/AuthProvider.jsx'
import PixelButton from './pixel/PixelButton.jsx'
import PixelLogo from './pixel/PixelLogo.jsx'

// Top bar for the signed-in pages (board, gym).
export default function AppShell({ children }) {
  const { user, signOut } = useAuth()
  return (
    <div className="min-h-screen bg-mist">
      <header className="border-b-2 border-ink bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 font-pixel text-xl font-bold text-ink">
            <PixelLogo className="size-7" />
            <span>Glitch Detective</span>
          </Link>
          <nav aria-label="Account" className="flex items-center gap-5">
            <Link to="/board" className="font-label text-xs text-ink transition-colors hover:text-primary">
              Board
            </Link>
            <span className="hidden max-w-48 truncate text-sm text-muted sm:inline">{user?.email}</span>
            <PixelButton variant="ghost" onClick={signOut} className="px-3 py-2">
              Sign out
            </PixelButton>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">{children}</main>
    </div>
  )
}
