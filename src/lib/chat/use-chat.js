import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/auth-provider.jsx'
import { joinTopic } from '../realtime/index.js'

// Without realtime the chat asks the API this often; with it, a nudge refetches at once and this
// slow check only catches a nudge that got lost.
export const POLL_MS = 5000
export const REALTIME_POLL_MS = 30_000

const EMPTY = { status: 'loading', messages: [], hasMore: false, meta: null, message: null }

// New messages go after the ones already shown, each once.
const merge = (current, incoming) => {
  const seen = new Set(current.map((item) => item.id))
  return [...current, ...incoming.filter((item) => !seen.has(item.id))]
}

// One chat (a conversation or a community): its messages, oldest first, kept fresh by realtime
// nudges on `topic` or by polling. load(cursor, token) answers { messages, hasMore, ...meta };
// send(body, token) answers the saved message. onIncoming(messages) hears about other people's
// new messages (for the screen reader announcement and the read mark).
// Returns { state, live, refresh, loadOlder, send, remove }.
export function useChat({ chatKey, load, send, topic, onIncoming }) {
  const { getToken } = useAuth()
  const [state, setState] = useState(EMPTY)
  const [live, setLive] = useState('off')
  const [loadingOlder, setLoadingOlder] = useState(false)
  const latest = useRef(state)
  const channel = useRef(null)
  const loadRef = useRef(load)
  const sendRef = useRef(send)
  const incomingRef = useRef(onIncoming)
  const keyRef = useRef(chatKey)
  keyRef.current = chatKey
  loadRef.current = load
  sendRef.current = send
  incomingRef.current = onIncoming
  latest.current = state

  const update = useCallback((change) => {
    setState((current) => {
      const next = change(current)
      latest.current = next
      return next
    })
  }, [])

  // The first page. A key change (another conversation) starts over.
  useEffect(() => {
    let alive = true
    update(() => EMPTY)
    if (!chatKey) return undefined
    getToken()
      .then((token) => loadRef.current({}, token))
      .then(({ messages, hasMore, ...meta }) => alive && update(() => ({ status: 'ready', messages, hasMore, meta, message: null })))
      .catch((err) => alive && update(() => ({ ...EMPTY, status: 'error', message: err.message })))
    return () => {
      alive = false
    }
  }, [chatKey, getToken, update])

  // Only what's new since the last message shown; the whole first page while there is none.
  const refresh = useCallback(async () => {
    const current = latest.current
    if (current.status !== 'ready' || document.hidden) return
    const key = keyRef.current
    try {
      const last = current.messages.at(-1)
      const { messages, hasMore, ...meta } = await loadRef.current(last ? { after: last.createdAt } : {}, await getToken())
      // Another chat opened while this answer was on its way.
      if (key !== keyRef.current) return
      const fresh = messages.filter((item) => !latest.current.messages.some((seen) => seen.id === item.id))
      update((now) => ({ ...now, messages: merge(now.messages, messages), hasMore: last ? now.hasMore : hasMore, meta: { ...now.meta, ...meta } }))
      const theirs = fresh.filter((item) => !item.mine)
      if (theirs.length) incomingRef.current?.(theirs)
    } catch {
      // A missed check is fine: the next one catches up.
    }
  }, [getToken, update])

  useEffect(() => {
    if (!chatKey || !topic) return undefined
    const joined = joinTopic(topic, { onChange: refresh, onStatus: setLive })
    channel.current = joined
    return () => {
      joined.leave()
      channel.current = null
      setLive('off')
    }
  }, [chatKey, topic, refresh])

  useEffect(() => {
    if (!chatKey || state.status !== 'ready') return undefined
    const timer = setInterval(refresh, live === 'live' ? REALTIME_POLL_MS : POLL_MS)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [chatKey, state.status, live, refresh])

  const loadOlder = useCallback(async () => {
    const first = latest.current.messages[0]
    if (!first || loadingOlder) return
    setLoadingOlder(true)
    try {
      const { messages, hasMore } = await loadRef.current({ before: first.createdAt }, await getToken())
      update((now) => ({ ...now, messages: [...messages.filter((item) => !now.messages.some((seen) => seen.id === item.id)), ...now.messages], hasMore }))
    } catch (err) {
      update((now) => ({ ...now, message: err.message }))
    } finally {
      setLoadingOlder(false)
    }
  }, [getToken, loadingOlder, update])

  // Throws the server's (translated) message when it can't be sent, so the composer keeps the text.
  const sendMessage = useCallback(
    async (body) => {
      const saved = await sendRef.current(body, await getToken())
      update((now) => ({ ...now, messages: merge(now.messages, [saved]) }))
      channel.current?.nudge(null)
      return saved
    },
    [getToken, update],
  )

  const remove = useCallback((id) => update((now) => ({ ...now, messages: now.messages.filter((item) => item.id !== id) })), [update])

  return { state, live, loadingOlder, refresh, loadOlder, send: sendMessage, remove }
}
