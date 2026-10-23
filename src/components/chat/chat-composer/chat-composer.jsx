import { useId, useRef, useState } from 'react'
import { MESSAGE_LIMITS } from '../../../../shared/messages.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'

// Where a message is written. Enter sends, Shift+Enter starts a new line; the count of characters
// left shows up near the limit. onSend(body) throws the server's message when it can't be sent,
// and then the text stays in the box.
export default function ChatComposer({ onSend, placeholder, label }) {
  const t = useT()
  const id = useId()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState(null)
  const box = useRef(null)
  const body = text.trim()
  const left = MESSAGE_LIMITS.body - text.length
  const tooLong = left < 0

  async function send() {
    if (!body || tooLong || sending) return
    setSending(true)
    setMessage(null)
    try {
      await onSend(body)
      setText('')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setSending(false)
      box.current?.focus()
    }
  }

  function onKeyDown(event) {
    // Enter while picking an accented letter or a word from an input method doesn't send.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
      className="border-t-2 border-ink bg-white p-3"
    >
      <label htmlFor={id} className="sr-only">
        {label ?? t('chat.composer.label')}
      </label>
      <div className="flex items-end gap-2">
        <textarea
          ref={box}
          id={id}
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-describedby={`${id}-hint`}
          aria-invalid={tooLong}
          className="max-h-40 min-h-12 min-w-0 flex-1 resize-y border-2 border-ink bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel"
        />
        <PixelButton type="submit" disabled={!body || tooLong || sending} className="min-h-12 px-4">
          {sending ? t('chat.composer.sending') : t('chat.composer.send')}
        </PixelButton>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
        <span id={`${id}-hint`} className="hidden font-label sm:inline">
          {t('chat.composer.hint')}
        </span>
        {text.length >= MESSAGE_LIMITS.counterFrom && (
          <span aria-live="polite" className={`ml-auto font-label ${tooLong ? 'text-primary' : ''}`}>
            {tooLong ? t('chat.composer.over', { count: -left }) : t('chat.composer.left', { count: left })}
          </span>
        )}
      </div>
      {message && (
        <p role="alert" className="mt-2 border-2 border-ink bg-primary-soft px-3 py-2 text-sm text-ink">
          {message}
        </p>
      )}
    </form>
  )
}
