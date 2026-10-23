import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useMessageToasts } from '../../../lib/chat/message-alerts.jsx'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelAvatar from '../../ui/pixel-avatar/pixel-avatar.jsx'

export const SHOW_MS = 6000

function MessageToast({ toast, onDismiss }) {
  const t = useT()
  // Hovering or focusing it holds it on screen; leaving starts the count again.
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (held) return undefined
    const timer = setTimeout(() => onDismiss(toast.id), SHOW_MS)
    return () => clearTimeout(timer)
  }, [toast.id, toast.at, held, onDismiss])
  const hold = () => setHeld(true)
  const release = () => setHeld(false)

  return (
    <li
      onMouseEnter={hold}
      onMouseLeave={release}
      onFocus={hold}
      onBlur={release}
      className="pointer-events-auto flex items-center gap-3 border-2 border-ink bg-white p-3 shadow-pixel motion-safe:animate-toast-in"
    >
      <PixelAvatar seed={toast.avatar.seed} color={toast.avatar.color} className="size-12 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block font-label text-[10px] text-primary">{t('chat.toast.new')}</span>
        <Link
          to={`/messages/${toast.id}`}
          onClick={() => onDismiss(toast.id)}
          className="block break-words font-pixel text-lg font-bold leading-tight text-ink hover:text-primary"
        >
          <span aria-hidden="true">💬 </span>
          {t('chat.toast.title', { name: toast.name, count: toast.count })}
        </Link>
        {toast.preview && <span className="block truncate text-xs text-muted">{toast.preview}</span>}
      </span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={t('chat.toast.dismiss', { name: toast.name })}
        className="self-start px-1 text-muted hover:text-ink"
      >
        ×
      </button>
    </li>
  )
}

// Announces direct messages that arrive while the app is open, next to the badge toasts.
// Polite: read out when the screen reader is free, and focus stays where it was.
export default function MessageToasts() {
  const alerts = useMessageToasts()
  const t = useT()
  if (!alerts) return null
  return (
    <div role="status" aria-live="polite" aria-label={t('chat.toast.list')}>
      <ul className="flex flex-col gap-3">
        {alerts.toasts.map((toast) => (
          <MessageToast key={toast.id} toast={toast} onDismiss={alerts.dismiss} />
        ))}
      </ul>
    </div>
  )
}
