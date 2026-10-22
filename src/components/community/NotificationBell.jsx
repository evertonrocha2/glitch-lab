import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { timeAgo } from '../../lib/caseInfo.js'
import { useNotifications } from '../../lib/community/notifications.js'
import PixelAvatar from '../pixel/PixelAvatar.jsx'
import CommunityIcon from './CommunityIcon.jsx'

// Light polling: once a minute, and whenever the tab comes back into focus.
export const POLL_MS = 60_000

// "Ana commented on Undefined everywhere", "Bo rated Undefined everywhere valid".
export function notificationText({ type, actor, articleTitle }) {
  const title = articleTitle ?? 'your article'
  if (type === 'comment') return `${actor.name} commented on ${title}`
  if (type === 'like') return `${actor.name} liked ${title}`
  if (type === 'rating_valid') return `${actor.name} rated ${title} valid`
  return `${actor.name} rated ${title} bad`
}

// The bell in the app header: an unread badge, and a dropdown list that opens each article.
export default function NotificationBell() {
  const { data, refresh, markRead } = useNotifications()
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
        aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
        className="relative grid size-8 place-items-center border-2 border-ink bg-white text-ink transition-transform hover:-translate-y-0.5 sm:size-9"
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
            <span className="font-label text-xs text-ink">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={() => markRead(null)} className="font-label text-[10px] text-secondary hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">No notifications yet.</p>
          ) : (
            <ul aria-label="Notifications" className="max-h-96 divide-y-2 divide-line overflow-y-auto">
              {notifications.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/articles/${item.articleId}`}
                    onClick={() => openItem(item)}
                    className={`flex items-start gap-2.5 px-3 py-2.5 hover:bg-mist ${item.read ? '' : 'bg-primary-soft'}`}
                  >
                    <PixelAvatar seed={item.actor.avatar.seed} color={item.actor.avatar.color} className="size-7" />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm text-ink">{notificationText(item)}</span>
                      <span className="block text-xs text-muted">
                        {timeAgo(item.createdAt)}
                        {!item.read && <span className="sr-only"> (unread)</span>}
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
