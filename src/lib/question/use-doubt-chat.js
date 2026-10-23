import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthError, createCaseFromQuestion, streamQuestion } from '../api.js'
import { useAuth } from '../auth/auth-provider.jsx'
import { atTurnCap, loadChat, saveChat, toApiMessages } from './doubt-chat.js'

const newId = () => crypto.randomUUID()

// The doubt chat's state: messages ({ id, role, content, code?, card?, cardState?, caseId?,
// stopped? }), the answer streaming in, the last error, and what screen readers should hear once.
// Nothing is sent until the student sends a question: opening the chat never calls the AI.
// onCreated(case): a proposed card was accepted and is on the board now.
export function useDoubtChat({ onCreated } = {}) {
  const { user, getToken, signOut } = useAuth()
  const userId = user?.id
  const [messages, setMessages] = useState(() => (userId ? loadChat(userId) : []))
  // { text } while the tutor writes ('' until the first word).
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [creating, setCreating] = useState(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const pendingRef = useRef(pending)
  pendingRef.current = pending
  const streamRef = useRef(null)
  // Bumped by New chat and Stop, so a late answer can't land in the wrong chat.
  const chat = useRef(0)

  const update = useCallback(
    (next) => {
      messagesRef.current = next
      setMessages(next)
      if (userId) saveChat(userId, next)
    },
    [userId],
  )

  const abandon = useCallback(() => {
    chat.current++
    streamRef.current?.abort()
    streamRef.current = null
  }, [])

  // Closing the chat stops the answer in flight; what was said stays for next time.
  useEffect(() => abandon, [abandon])

  const ask = useCallback(
    async (history) => {
      const call = chat.current
      const stream = new AbortController()
      streamRef.current = stream
      setPending({ text: '' })
      setError('')
      const onEvent = ({ type, data }) => {
        if (call !== chat.current || type !== 'delta' || typeof data?.text !== 'string') return
        setPending((current) => current && { text: current.text + data.text })
      }
      try {
        const answer = await streamQuestion({ messages: toApiMessages(history) }, await getToken(), { onEvent, signal: stream.signal })
        if (call !== chat.current) return
        const reply = { id: newId(), role: 'assistant', content: answer.reply, ...(answer.card ? { card: answer.card, cardState: 'open' } : {}) }
        update([...messagesRef.current, reply])
        setAnnouncement({ id: reply.id, text: answer.reply, card: answer.card ?? null })
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

  // false when there is nothing to send, an answer is still coming, or the chat is at its cap.
  const send = useCallback(
    (text, code = '') => {
      const content = text.trim()
      if (!content || pendingRef.current || atTurnCap(messagesRef.current)) return false
      const question = { id: newId(), role: 'user', content, ...(code.trim() ? { code } : {}) }
      const history = [...messagesRef.current, question]
      update(history)
      ask(history)
      return true
    },
    [update, ask],
  )

  // After a failed answer the last message is still the question: send it again.
  const retry = useCallback(() => {
    if (pendingRef.current || messagesRef.current.at(-1)?.role !== 'user') return
    ask(messagesRef.current)
  }, [ask])

  // Stop: whatever was written so far stays in the chat, marked as stopped, with no card.
  const stop = useCallback(() => {
    const current = pendingRef.current
    if (!current) return
    abandon()
    setPending(null)
    if (current.text.trim()) update([...messagesRef.current, { id: newId(), role: 'assistant', content: current.text.trim(), stopped: true }])
  }, [abandon, update])

  const newChat = useCallback(() => {
    abandon()
    update([])
    setPending(null)
    setError('')
    setAnnouncement('')
  }, [abandon, update])

  const setCard = useCallback((id, patch) => update(messagesRef.current.map((item) => (item.id === id ? { ...item, ...patch } : item))), [update])
  const dismissCard = useCallback((id) => setCard(id, { cardState: 'dismissed' }), [setCard])
  const reopenCard = useCallback((id) => setCard(id, { cardState: 'open', cardError: '' }), [setCard])

  // The card goes to the board with the chat up to the answer that proposed it. No AI call.
  const acceptCard = useCallback(
    async (id) => {
      const index = messagesRef.current.findIndex((item) => item.id === id)
      const message = messagesRef.current[index]
      if (!message?.card || creating) return
      setCreating(id)
      setCard(id, { cardError: '' })
      try {
        const made = await createCaseFromQuestion({ messages: toApiMessages(messagesRef.current.slice(0, index + 1)), card: message.card }, await getToken())
        setCard(id, { cardState: 'created', caseId: made.id })
        setAnnouncement({ id: `${id}:created`, created: message.card })
        onCreated?.(made)
      } catch (err) {
        if (err instanceof AuthError) await signOut()
        else setCard(id, { cardError: err.message })
      } finally {
        setCreating(null)
      }
    },
    [creating, getToken, onCreated, setCard, signOut],
  )

  return { messages, pending, error, announcement, creating, send, retry, stop, newChat, acceptCard, dismissCard, reopenCard, atCap: atTurnCap(messages) }
}
