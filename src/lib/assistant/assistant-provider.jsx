import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AuthError, askAssistant, StreamUnavailableError, streamAssistant } from '../api.js'
import { useAuth } from '../auth/auth-provider.jsx'
import { appendDelta, loadConversation, saveConversation, stoppedMessage, toApiMessages } from './conversation.js'

const AssistantContext = createContext(null)
const newId = () => crypto.randomUUID()

// Lives above the routes, so the chat and a question in flight survive moving between pages.
export function AssistantProvider({ children }) {
  const { user, getToken, signOut } = useAuth()
  const userId = user?.id
  const [isOpen, setOpen] = useState(false)
  const [messages, setMessages] = useState(() => (userId ? loadConversation(userId) : []))
  // { question, page, steps, parts } while waiting: the server's steps so far, and the answer's
  // text as it streams in (parts like a finished answer's, [] until the first word).
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')
  // The last finished answer, for screen readers: announced once, not at every streamed word.
  const [announcement, setAnnouncement] = useState('')
  // What the current page reports about itself (the board's open case).
  const [focus, setFocus] = useState(null)
  // Bumped by New chat, Stop and sign-in changes, so a late answer can't land in the wrong chat.
  const chat = useRef(0)
  const streamRef = useRef(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const pendingRef = useRef(pending)
  pendingRef.current = pending

  // Leaves the answer in flight behind: the stream closes, so the server stops the AI too.
  const abandon = useCallback(() => {
    chat.current++
    streamRef.current?.abort()
    streamRef.current = null
  }, [])

  // Signing out wipes that account's chat: it holds summaries of their cases and notes.
  const lastUser = useRef(userId)
  useEffect(() => {
    if (lastUser.current && lastUser.current !== userId) saveConversation(lastUser.current, [])
    lastUser.current = userId
  }, [userId])

  useEffect(() => {
    abandon()
    setMessages(userId ? loadConversation(userId) : [])
    setPending(null)
    setError('')
    setOpen(false)
  }, [userId, abandon])

  const update = useCallback(
    (next) => {
      messagesRef.current = next
      setMessages(next)
      if (userId) saveConversation(userId, next)
    },
    [userId],
  )

  // Sends the conversation as it stands; the last message is the student's question. Streams the
  // answer, and asks the plain endpoint instead when the stream can't be used before any text came.
  const ask = useCallback(
    async (history, page) => {
      const call = chat.current
      const stream = new AbortController()
      streamRef.current = stream
      setPending({ question: history.at(-1).content, page, steps: [], parts: [] })
      setError('')
      const body = { messages: toApiMessages(history), page }
      let wrote = false
      const onEvent = ({ type, data }) => {
        if (call !== chat.current) return
        if (type === 'step' && typeof data?.text === 'string') {
          setPending((current) => current && (current.steps.includes(data.text) ? current : { ...current, steps: [...current.steps, data.text] }))
        } else if (type === 'delta' && typeof data?.text === 'string' && data.text) {
          wrote = true
          setPending((current) => current && { ...current, parts: appendDelta(current.parts, data) })
        }
      }
      try {
        let answer
        try {
          answer = await streamAssistant(body, await getToken(), { onEvent, signal: stream.signal })
        } catch (err) {
          if (!(err instanceof StreamUnavailableError) || wrote || call !== chat.current) throw err
          answer = await askAssistant(body, await getToken())
        }
        if (call !== chat.current) return
        const reply = {
          id: newId(),
          role: 'assistant',
          content: answer.reply,
          parts: answer.parts,
          agents: answer.agents,
          actions: answer.actions,
          steps: answer.steps,
        }
        update([...messagesRef.current, reply])
        setAnnouncement(answer.reply)
      } catch (err) {
        if (call !== chat.current) return
        if (err instanceof AuthError) await signOut()
        else setError(err.message)
      } finally {
        if (call === chat.current) {
          setPending(null)
          streamRef.current = null
        }
      }
    },
    [getToken, signOut, update],
  )

  const send = useCallback(
    (text, page) => {
      const question = text.trim()
      if (!question || pending) return false
      const history = [...messagesRef.current, { id: newId(), role: 'user', content: question }]
      update(history)
      ask(history, page)
      return true
    },
    [pending, update, ask],
  )

  // After a failed answer the last message is still the question: send it again.
  const retry = useCallback(
    (page) => {
      const history = messagesRef.current
      if (pending || history.at(-1)?.role !== 'user') return
      ask(history, page)
    },
    [pending, ask],
  )

  // Stop: whatever was written so far stays in the chat, marked as stopped.
  const stop = useCallback(() => {
    const current = pendingRef.current
    if (!current) return
    abandon()
    setPending(null)
    if (current.parts.some((part) => part.reply.trim())) update([...messagesRef.current, stoppedMessage(newId(), current.parts, current.steps)])
  }, [abandon, update])

  const newChat = useCallback(() => {
    abandon()
    update([])
    setPending(null)
    setError('')
    setAnnouncement('')
  }, [abandon, update])

  const open = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((current) => !current), [])

  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      messages,
      pending,
      error,
      announcement,
      send,
      retry,
      stop,
      newChat,
      focus,
      setFocus,
    }),
    [isOpen, open, close, toggle, messages, pending, error, announcement, send, retry, stop, newChat, focus],
  )
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}

// { isOpen, open, close, toggle, messages, pending, error, announcement, send, retry, stop, newChat, focus }
export function useAssistant() {
  const value = useContext(AssistantContext)
  if (!value) throw new Error('useAssistant must be used inside <AssistantProvider>')
  return value
}

// A page tells the assistant what it has open, e.g. useAssistantFocus({ caseId }) on the board.
// Does nothing outside the provider, so pages still render on their own.
export function useAssistantFocus(focus) {
  const setFocus = useContext(AssistantContext)?.setFocus
  const caseId = focus?.caseId ?? null
  useEffect(() => {
    if (!setFocus) return
    setFocus(caseId ? { caseId } : null)
    return () => setFocus(null)
  }, [setFocus, caseId])
}
