import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AuthError, askAssistant } from '../api.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { loadConversation, saveConversation, toApiMessages } from './conversation.js'

const AssistantContext = createContext(null)
const newId = () => crypto.randomUUID()

// Lives above the routes, so the chat and a question in flight survive moving between pages.
export function AssistantProvider({ children }) {
  const { user, getToken, signOut } = useAuth()
  const userId = user?.id
  const [isOpen, setOpen] = useState(false)
  const [messages, setMessages] = useState(() => (userId ? loadConversation(userId) : []))
  // { question, page } while waiting for an answer.
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')
  // What the current page reports about itself (the board's open case).
  const [focus, setFocus] = useState(null)
  // Bumped by New chat and sign-in changes, so a late answer can't land in the wrong chat.
  const chat = useRef(0)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  useEffect(() => {
    chat.current++
    setMessages(userId ? loadConversation(userId) : [])
    setPending(null)
    setError('')
    setOpen(false)
  }, [userId])

  const update = useCallback(
    (next) => {
      messagesRef.current = next
      setMessages(next)
      if (userId) saveConversation(userId, next)
    },
    [userId],
  )

  // Sends the conversation as it stands; the last message is the student's question.
  const ask = useCallback(
    async (history, page) => {
      const call = chat.current
      setPending({ question: history.at(-1).content, page })
      setError('')
      try {
        const answer = await askAssistant({ messages: toApiMessages(history), page }, await getToken())
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
      } catch (err) {
        if (call !== chat.current) return
        if (err instanceof AuthError) await signOut()
        else setError(err.message)
      } finally {
        if (call === chat.current) setPending(null)
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

  const newChat = useCallback(() => {
    chat.current++
    update([])
    setPending(null)
    setError('')
  }, [update])

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
      send,
      retry,
      newChat,
      focus,
      setFocus,
    }),
    [isOpen, open, close, toggle, messages, pending, error, send, retry, newChat, focus],
  )
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}

// { isOpen, open, close, toggle, messages, pending, error, send, retry, newChat, focus }
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
