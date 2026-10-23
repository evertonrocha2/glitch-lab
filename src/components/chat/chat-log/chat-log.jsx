import { useLayoutEffect, useRef, useState } from 'react'
import { useI18n, useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../../../lib/i18n/format.js'
import PixelAvatar from '../../ui/pixel-avatar/pixel-avatar.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import MessageText from '../message-text/message-text.jsx'

// Within this many pixels of the bottom counts as "reading the latest", so new messages scroll in.
const NEAR_BOTTOM = 80

const localDay = (iso) => {
  const date = new Date(iso)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

// [{ day, label, messages }] in order, one group per calendar day in the reader's time zone.
function byDay(messages) {
  const groups = []
  for (const message of messages) {
    const day = localDay(message.createdAt)
    if (groups.at(-1)?.day !== day) groups.push({ day, first: message.createdAt, messages: [] })
    groups.at(-1).messages.push(message)
  }
  return groups
}

function dayLabel(t, format, iso, now = new Date()) {
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (localDay(iso) === localDay(now.toISOString())) return t('chat.today')
  if (localDay(iso) === localDay(yesterday.toISOString())) return t('chat.yesterday')
  return format.capitalize(format.date(iso, { weekday: 'long', day: 'numeric', month: 'long' }))
}

function Message({ message, showSender, actions }) {
  const t = useT()
  const { locale } = useI18n()
  const time = new Date(message.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const bubble = message.mine
    ? 'border-ink bg-primary text-white shadow-[3px_3px_0_var(--color-ink)]'
    : 'border-ink bg-white text-ink shadow-[3px_3px_0_var(--color-line)]'
  return (
    <li className={`group flex gap-2 ${message.mine ? 'justify-end' : 'justify-start'} ${showSender ? 'mt-3' : 'mt-1'}`}>
      {!message.mine && (
        <span className="w-8 shrink-0">{showSender && <PixelAvatar seed={message.sender.avatar.seed} color={message.sender.avatar.color} className="size-8" />}</span>
      )}
      <div className={`flex max-w-[85%] min-w-0 flex-col sm:max-w-[75%] ${message.mine ? 'items-end' : 'items-start'}`}>
        {/* Screen readers hear who wrote each message; sighted readers see it once per run. */}
        <span className={showSender && !message.mine ? 'mb-1 font-label text-[10px] text-muted' : 'sr-only'}>
          {message.mine ? t('chat.you') : message.sender.name}
        </span>
        <p className={`border-2 px-3 py-2 text-sm leading-relaxed ${bubble}`}>
          <MessageText body={message.body} linkClassName={message.mine ? 'font-semibold text-white underline underline-offset-2' : 'font-semibold text-secondary underline underline-offset-2'} />
        </p>
        <span className="mt-1 flex items-center gap-3 text-[10px] text-muted">
          <time dateTime={message.createdAt}>{time}</time>
          {actions}
        </span>
      </div>
    </li>
  )
}

// A chat's messages, oldest at the top and grouped by day. It follows new messages while you're
// at the bottom and leaves you alone when you've scrolled up to read (a button jumps back down).
// announcement: a sentence about other people's new messages, read once by screen readers.
export default function ChatLog({ messages, hasMore, loadingOlder, onLoadOlder, renderActions, emptyText, label, announcement, className = '' }) {
  const t = useT()
  const format = useFormat()
  const box = useRef(null)
  const nearBottom = useRef(true)
  const previous = useRef({ first: null, last: null, height: 0, top: 0 })
  const [behind, setBehind] = useState(false)

  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const first = messages[0]?.id ?? null
    const last = messages.at(-1) ?? null
    const before = previous.current
    if (before.last === null || (last && before.last !== last.id && (nearBottom.current || last.mine))) {
      // First paint, or a new message while reading the latest (or my own): show the bottom.
      element.scrollTop = element.scrollHeight
      setBehind(false)
    } else if (first !== before.first && last?.id === before.last) {
      // Older messages came in on top: keep the same message under the reader's eyes.
      element.scrollTop = element.scrollHeight - before.height + before.top
    } else if (last && before.last !== last.id) {
      setBehind(true)
    }
    previous.current = { first, last: last?.id ?? null, height: element.scrollHeight, top: element.scrollTop }
  }, [messages])

  function onScroll() {
    const element = box.current
    nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM
    if (nearBottom.current) setBehind(false)
    previous.current = { ...previous.current, height: element.scrollHeight, top: element.scrollTop }
  }

  function jumpDown() {
    box.current.scrollTop = box.current.scrollHeight
    nearBottom.current = true
    setBehind(false)
  }

  return (
    <div className={`relative flex min-h-0 flex-col ${className}`}>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <div ref={box} onScroll={onScroll} role="region" tabIndex={0} aria-label={label} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 focus:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-secondary)] sm:px-4">
        {hasMore && (
          <div className="mb-3 text-center">
            <PixelButton variant="ghost" onClick={onLoadOlder} disabled={loadingOlder} className="px-3 py-2">
              {loadingOlder ? t('chat.loadingOlder') : t('chat.loadOlder')}
            </PixelButton>
          </div>
        )}
        {messages.length === 0 ? (
          <p className="grid min-h-40 place-items-center px-4 text-center text-sm text-muted">{emptyText}</p>
        ) : (
          <ol aria-label={label} className="space-y-4">
            {byDay(messages).map((group) => {
              const title = dayLabel(t, format, group.first)
              return (
                <li key={group.day}>
                  <h3 className="flex items-center gap-3 font-label text-[10px] text-muted before:h-0.5 before:flex-1 before:bg-line after:h-0.5 after:flex-1 after:bg-line">
                    {title}
                  </h3>
                  <ol aria-label={title}>
                    {group.messages.map((message, index) => (
                      <Message
                        key={message.id}
                        message={message}
                        showSender={index === 0 || group.messages[index - 1].sender?.name !== message.sender?.name || group.messages[index - 1].mine !== message.mine}
                        actions={renderActions?.(message)}
                      />
                    ))}
                  </ol>
                </li>
              )
            })}
          </ol>
        )}
      </div>
      {behind && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <PixelButton variant="secondary" onClick={jumpDown} className="pointer-events-auto px-3 py-2">
            {t('chat.newBelow')}
          </PixelButton>
        </div>
      )}
    </div>
  )
}
