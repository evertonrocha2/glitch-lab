import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getConversationMessages, listConversations } from '../api.js'
import { useAuth } from '../auth/auth-provider.jsx'
import { useNotifications } from '../community/notifications.js'
import { joinTopic, userTopic } from '../realtime/index.js'
import { setUnreadMessages, useUnreadCount } from './unread.js'

// New direct messages while the app is open. Every signed-in page listens on its own account's
// topic (`user:<myId>`); the server nudges it when someone sends me a message. A nudge (or the slow
// poll, in case one got lost) refetches the inbox and the bell, and each conversation with news
// from the other person gets one toast. The first check only notes what's there: old unread
// messages never pop up, only the ones that arrive after.

// Without realtime the inbox is checked this often; with it, the poll only catches a lost nudge.
// A hidden tab skips its checks, and coming back checks at once.
export const ALERT_POLL_MS = 10_000
export const ALERT_REALTIME_POLL_MS = 30_000
export const PREVIEW_CHARS = 80
// At most this many message toasts at once: the oldest goes first.
const MAX_TOASTS = 3

// One line of plain text, cut at about 80 characters.
export function previewText(body, max = PREVIEW_CHARS) {
  const text = String(body ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text
}

// "Glitch Lab" -> "(2) Glitch Lab", and back once nothing is unread.
const COUNT_PREFIX = /^\(\d+\+?\)\s+/
export function titleWithCount(title, count) {
  const base = title.replace(COUNT_PREFIX, '')
  return count > 0 ? `(${count}) ${base}` : base
}

const ToastsContext = createContext(null)
const ControlsContext = createContext(null)

// The conversation ids and their last message times, to spot what's new on the next check.
const snapshot = (conversations) => new Map(conversations.map((item) => [item.id, item.lastMessageAt]))

function sameSnapshot(a, b) {
  if (a.size !== b.size) return false
  for (const [id, at] of a) if (b.get(id) !== at) return false
  return true
}

export function MessageAlertsProvider({ children }) {
  const { user, getToken } = useAuth()
  const userId = user?.id
  // Demo accounts can't have conversations, so they never ask.
  const active = Boolean(userId && !user.isDemo)
  const { refresh: refreshBell } = useNotifications()
  const unread = useUnreadCount(userId)
  const [toasts, setToasts] = useState([])
  const [live, setLive] = useState('off')
  // null until the first check: everything found then is old news.
  const seen = useRef(null)
  const openId = useRef(null)
  const running = useRef(null)
  const again = useRef(false)
  const account = useRef(userId)
  const bell = useRef(refreshBell)
  const inboxListeners = useRef(new Set())
  bell.current = refreshBell
  account.current = userId

  // Another account (or signed out): start over, with nothing seen and no toasts.
  useEffect(() => {
    seen.current = null
    setToasts([])
  }, [userId])

  const checkOnce = useCallback(async () => {
    const owner = userId
    let list
    let token
    try {
      token = await getToken()
      list = await listConversations(token)
    } catch {
      // A missed check is fine: the next one catches up.
      return
    }
    if (account.current !== owner) return
    setUnreadMessages(owner, list.unread)
    const before = seen.current
    const now = snapshot(list.conversations)
    seen.current = now
    if (!before) return
    if (sameSnapshot(before, now)) return
    bell.current?.()
    for (const listener of inboxListeners.current) listener()

    const news = list.conversations.filter(
      (item) => item.unread && !item.blocked && item.lastMessage && !item.lastMessage.mine && item.lastMessageAt && item.lastMessageAt !== before.get(item.id),
    )
    for (const item of news) {
      // Already open on screen: the conversation shows it and marks it read.
      if (openId.current === item.id && !document.hidden) continue
      const after = before.get(item.id)
      let count = 1
      let body = item.lastMessage.body
      try {
        const { messages } = await getConversationMessages(item.id, after ? { after } : {}, token)
        const theirs = messages.filter((message) => !message.mine)
        if (theirs.length) {
          count = theirs.length
          body = theirs.at(-1).body
        }
      } catch {
        // The inbox's last message is enough for the toast.
      }
      if (account.current !== owner || (openId.current === item.id && !document.hidden)) continue
      setToasts((current) => {
        const existing = current.find((toast) => toast.id === item.id)
        const toast = {
          id: item.id,
          name: item.other.name,
          avatar: item.other.avatar,
          preview: previewText(body),
          count: (existing?.count ?? 0) + count,
          at: Date.now(),
        }
        return [...current.filter((other) => other.id !== item.id), toast].slice(-MAX_TOASTS)
      })
    }
  }, [userId, getToken])

  // One check at a time; a nudge during one asks for another right after.
  const check = useCallback(() => {
    if (!active || document.hidden) return Promise.resolve()
    if (running.current) {
      again.current = true
      return running.current
    }
    running.current = (async () => {
      do {
        again.current = false
        await checkOnce()
      } while (again.current && !document.hidden)
    })().finally(() => {
      running.current = null
    })
    return running.current
  }, [active, checkOnce])

  // A nudge on my own topic: the server says someone sent me something.
  useEffect(() => {
    if (!active) return undefined
    const joined = joinTopic(userTopic(userId), { onChange: check, onStatus: setLive })
    return () => {
      joined.leave()
      setLive('off')
    }
  }, [active, userId, check])

  // The first check (what's already there), then the slow poll.
  useEffect(() => {
    if (active) check()
  }, [active, check])

  useEffect(() => {
    if (!active) return undefined
    const timer = setInterval(check, live === 'live' ? ALERT_REALTIME_POLL_MS : ALERT_POLL_MS)
    const onVisible = () => !document.hidden && check()
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, live, check])

  // "(2) Glitch Lab" in the tab while something is unread.
  useEffect(() => {
    document.title = titleWithCount(document.title, active ? unread : 0)
  }, [active, unread])

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

  const controls = useMemo(
    () => ({
      // The conversation on screen: no toast for it, and its toast goes away.
      watch(id) {
        openId.current = id
        dismiss(id)
        return () => {
          if (openId.current === id) openId.current = null
        }
      },
      onInboxChange(listener) {
        inboxListeners.current.add(listener)
        return () => inboxListeners.current.delete(listener)
      },
    }),
    [dismiss],
  )
  const toastsValue = useMemo(() => ({ toasts, dismiss }), [toasts, dismiss])

  return (
    <ControlsContext.Provider value={controls}>
      <ToastsContext.Provider value={toastsValue}>{children}</ToastsContext.Provider>
    </ControlsContext.Provider>
  )
}

// { toasts: [{ id (the conversation), name, avatar, preview, count, at }], dismiss(id) }, or null
// outside the provider (then nothing is shown).
export const useMessageToasts = () => useContext(ToastsContext)

// Called by the open conversation, so it gets no toast of its own.
export function useWatchConversation(id) {
  const controls = useContext(ControlsContext)
  useEffect(() => (controls && id ? controls.watch(id) : undefined), [controls, id])
}

// listener() whenever a check finds the inbox changed (the messages page reloads its list).
export function useInboxChange(listener) {
  const controls = useContext(ControlsContext)
  const latest = useRef(listener)
  latest.current = listener
  useEffect(() => (controls ? controls.onInboxChange(() => latest.current()) : undefined), [controls])
}
