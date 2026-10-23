import { Link } from 'react-router'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../../../lib/i18n/format.js'
import PixelAvatar from '../../ui/pixel-avatar/pixel-avatar.jsx'
import Skeleton, { Bone, Line } from '../../ui/skeleton/skeleton.jsx'

function preview(t, item) {
  if (item.blocked) return t('chat.inbox.blocked')
  if (!item.lastMessage) return ''
  const text = item.lastMessage.body.replace(/\s+/g, ' ')
  return item.lastMessage.mine ? t('chat.inbox.youSaid', { text }) : text
}

export function InboxSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('chat.inbox.loading')} className="divide-y-2 divide-line">
      {[1, 2, 3, 4].map((slot) => (
        <div key={slot} className="flex items-center gap-3 px-3 py-3">
          <Bone className="size-10 shrink-0 border-2 border-ink" />
          <div className="min-w-0 flex-1">
            <Line className="font-pixel text-base" width="w-1/2" />
            <Line className="text-xs" width="w-4/5" />
          </div>
        </div>
      ))}
    </Skeleton>
  )
}

// My conversations, the latest first: who, the last message, when, and a dot for unread ones.
export default function Inbox({ state, activeId }) {
  const t = useT()
  const { since } = useFormat()
  if (state.status === 'loading') return <InboxSkeleton />
  if (state.status === 'error') return <p className="p-4 text-sm text-muted">{state.message}</p>
  if (!state.conversations.length) {
    return (
      <div className="p-5 text-sm text-muted">
        <p>{t('chat.inbox.empty')}</p>
        <Link to="/people" className="mt-3 inline-flex min-h-10 items-center font-label text-xs text-primary underline underline-offset-4">
          {t('chat.inbox.findPeople')}
        </Link>
      </div>
    )
  }
  return (
    <ul aria-label={t('chat.inbox.label')} className="divide-y-2 divide-line">
      {state.conversations.map((item) => {
        const active = item.id === activeId
        return (
          <li key={item.id}>
            <Link
              to={`/messages/${item.id}`}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-16 items-center gap-3 px-3 py-3 transition-colors hover:bg-mist ${active ? 'bg-primary-soft' : item.unread ? 'bg-secondary-soft/60' : ''}`}
            >
              <PixelAvatar seed={item.other.avatar.seed} color={item.other.avatar.color} className="size-10" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <strong className={`truncate text-sm text-ink ${item.unread ? 'font-bold' : 'font-semibold'}`}>{item.other.name}</strong>
                  {item.lastMessageAt && (
                    <time dateTime={item.lastMessageAt} className="shrink-0 text-[10px] text-muted">
                      {since(item.lastMessageAt)}
                    </time>
                  )}
                </span>
                <span className={`block truncate text-xs ${item.unread ? 'text-ink' : 'text-muted'}`}>{preview(t, item)}</span>
              </span>
              {item.unread && (
                <>
                  <span aria-hidden="true" className="size-2.5 shrink-0 bg-primary" />
                  <span className="sr-only">{t('chat.inbox.unread')}</span>
                </>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
