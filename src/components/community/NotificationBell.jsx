import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useNotifications } from '../../lib/community/notifications.js'
import { translate, useT } from '../../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../../lib/i18n/format.js'
import PixelAvatar from '../pixel/PixelAvatar.jsx'
import CommunityIcon from './CommunityIcon.jsx'

// Light polling: once a minute, and whenever the tab comes back into focus.
export const POLL_MS = 60_000

const MESSAGE = { comment: 'notes.bell.comment', like: 'notes.bell.like', rating_valid: 'notes.bell.valid' }

// "Ana commented on Undefined everywhere", "Bo rated Undefined everywhere valid". t: useT(), English by default.
// Event notifications ("Bo joined Rinha de Backend") point at an event instead.
export function notificationText({ type, actor, articleTitle, eventTitle }, t = (key, vars) => translate('en', key, vars)) {
  if (type.startsWith('event_')) return t(`events.bell.${type}`, { name: actor.name, title: eventTitle ?? t('events.bell.someEvent') })
  const title = articleTitle ?? t('notes.bell.yourArticle')
  return t(MESSAGE[type] ?? 'notes.bell.bad', { name: actor.name, title })
}

// The bell in the app header: an unread badge, and a dropdown list that opens each article.
export default function NotificationBell() {
  const { data, refresh, markRead } = useNotifications()
  const t = useT()
  const { since } = useFormat()
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  // A click outside or Escape closes the list.
  useEffect(() => {
    if (!open) return
    const onPointer = (event) => box.current && !box.current.contains(event.target) && setOpen(false)
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function openItem(item) {
    setOpen(false)
    if (!item.read) markRead(item.id)
  }

  const { notifications, unread } = data
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? t('notes.bell.unread', { count: unread }) : t('notes.bell.label')}
        className="relative grid size-10 place-items-center border-2 border-ink bg-white text-ink transition-transform hover:-translate-y-0.5"
      >
        <CommunityIcon name="bell" className="size-4" />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute -top-2 -right-2 min-w-5 border-2 border-ink bg-primary px-1 font-label text-[10px] leading-4 text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Phones: pinned under the top row, full width. Wider screens: hangs from the bell. */}
      {open && (
        <div className="fixed inset-x-4 top-16 z-40 border-2 border-ink bg-white shadow-pixel sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-3 sm:w-[22rem]">
          <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-3 py-2">
            <span className="font-label text-xs text-ink">{t('notes.bell.label')}</span>
            {unread > 0 && (
              <button type="button" onClick={() => markRead(null)} className="font-label text-[10px] text-secondary hover:underline">
                {t('notes.bell.markAll')}
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">{t('notes.bell.empty')}</p>
          ) : (
            <ul aria-label={t('notes.bell.label')} className="max-h-96 divide-y-2 divide-line overflow-y-auto">
              {notifications.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.eventId ? `/events/${item.eventId}` : `/articles/${item.articleId}`}
                    onClick={() => openItem(item)}
                    className={`flex items-start gap-2.5 px-3 py-2.5 hover:bg-mist ${item.read ? '' : 'bg-primary-soft'}`}
                  >
                    <PixelAvatar seed={item.actor.avatar.seed} color={item.actor.avatar.color} className="size-7" />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm text-ink">{notificationText(item, t)}</span>
                      <span className="block text-xs text-muted">
                        {since(item.createdAt)}
                        {!item.read && <span className="sr-only"> {t('notes.bell.unreadMark')}</span>}
                      </span>
                    </span>
                    {!item.read && <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 bg-primary" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
