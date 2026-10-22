import { useEffect } from 'react'
import { Link } from 'react-router'
import { badgeById } from '../../shared/badges.js'
import { useProgress } from '../lib/progress/ProgressProvider.jsx'
import BadgeIcon from './pixel/BadgeIcon.jsx'

const SHOW_MS = 7000

function Toast({ id, onDismiss }) {
  const badge = badgeById(id)
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), SHOW_MS)
    return () => clearTimeout(timer)
  }, [id, onDismiss])
  if (!badge) return null

  return (
    <li className="flex items-center gap-3 border-2 border-ink bg-white p-3 shadow-pixel motion-safe:animate-toast-in">
      <span className="grid size-12 shrink-0 place-items-center border-2 border-ink bg-primary-soft">
        <BadgeIcon id={id} className="size-8" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-label text-[10px] text-primary">New badge</span>
        <Link to="/progress" className="block font-pixel text-lg font-bold leading-tight text-ink hover:text-primary">
          {badge.name}
        </Link>
        <span className="block text-xs text-muted">{badge.how}</span>
      </span>
      <button type="button" onClick={() => onDismiss(id)} aria-label={`Dismiss ${badge.name}`} className="self-start px-1 text-muted hover:text-ink">
        ×
      </button>
    </li>
  )
}

// Announces badges as they're earned, on any signed-in page.
export default function BadgeToasts() {
  const { toasts, dismissToast } = useProgress()
  return (
    <ul aria-live="polite" aria-label="New badges" className="fixed right-4 bottom-4 z-40 flex w-[calc(100vw-2rem)] max-w-80 flex-col gap-3">
      {toasts.map((id) => (
        <Toast key={id} id={id} onDismiss={dismissToast} />
      ))}
    </ul>
  )
}
