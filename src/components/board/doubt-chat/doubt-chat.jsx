import { useEffect, useRef, useState } from 'react'
import { QUESTION_LIMITS } from '../../../../shared/question.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { turnsUsed } from '../../../lib/question/doubt-chat.js'
import { useDoubtChat } from '../../../lib/question/use-doubt-chat.js'
import ReplyText, { TypingCaret } from '../../assistant/reply-text/reply-text.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import CardProposal from '../card-proposal/card-proposal.jsx'

const FOCUSABLE = 'button:not([disabled]), a[href], textarea:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

function StudentBubble({ message }) {
  const t = useT()
  return (
    <div className="flex flex-col items-end gap-1.5">
      <p className="max-w-[85%] whitespace-pre-line wrap-break-word border-2 border-ink bg-primary-soft px-3 py-2 text-sm text-ink shadow-pixel">{message.content}</p>
      {message.code && (
        <figure className="w-full max-w-[85%]">
          <figcaption className="font-label text-[10px] text-muted">{t('question.yourCode')}</figcaption>
          <pre className="mt-1 max-h-48 overflow-auto border-2 border-ink bg-white p-2.5 font-mono text-xs leading-relaxed text-ink">{message.code}</pre>
        </figure>
      )}
    </div>
  )
}

function TutorBubble({ text, streaming = false, stopped = false, children }) {
  const t = useT()
  return (
    <div className="border-2 border-ink bg-white p-3 shadow-pixel-secondary">
      <p className="font-label text-[10px] text-secondary">{streaming ? t('question.typing') : t('question.tutor')}</p>
      <div className="mt-1.5">
        <ReplyText text={text} caret={streaming} />
      </div>
      {stopped && <p className="mt-2 text-xs text-muted">{t('question.stopped')}</p>}
      {children}
    </div>
  )
}

// "Ask a question": a side panel (the whole screen on a phone) where the student talks a doubt
// through with the tutor. A tutor answer that knows the topic carries a card proposal.
// onCreated(case) when a card lands on the board; onOpenCase(id) to show it there.
export default function DoubtChat({ onClose, onCreated, onOpenCase }) {
  const t = useT()
  const chat = useDoubtChat({ onCreated })
  const { messages, pending, error, announcement, creating, atCap } = chat
  const [draft, setDraft] = useState('')
  const [code, setCode] = useState('')
  const [withCode, setWithCode] = useState(false)
  const panel = useRef(null)
  const input = useRef(null)
  const log = useRef(null)
  const empty = messages.length === 0 && !pending

  // Focus goes to the question box and comes back to whatever opened the chat.
  useEffect(() => {
    const opener = document.activeElement
    input.current?.focus()
    return () => opener?.focus?.()
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: these are the moments the log grows.
  useEffect(() => {
    log.current?.scrollTo?.({ top: log.current.scrollHeight })
  }, [messages.length, pending, error])

  function submit() {
    if (chat.send(draft, withCode ? code : '')) {
      setDraft('')
      setCode('')
      setWithCode(false)
    }
  }

  function startOver() {
    chat.newChat()
    input.current?.focus()
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = [...panel.current.querySelectorAll(FOCUSABLE)]
    if (!items.length) return
    const first = items[0]
    const last = items.at(-1)
    if (event.shiftKey && (document.activeElement === first || !panel.current.contains(document.activeElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  // Said once per finished answer (and once when a card is made), never at every streamed word.
  const spoken = !announcement
    ? ''
    : announcement.created
      ? t('question.card.announceCreated', { title: announcement.created.title })
      : [announcement.text, announcement.card && t('question.card.announce', { title: announcement.card.title })].filter(Boolean).join(' ')

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" tabIndex={-1} aria-label={t('question.close')} onClick={onClose} className="absolute inset-0 cursor-default bg-ink/40" />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="doubt-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative flex h-full w-full max-w-xl flex-col border-l-2 border-ink bg-mist focus-visible:outline-none"
      >
        <header className="flex items-center gap-3 border-b-2 border-ink bg-secondary px-4 py-3 text-white">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center border-2 border-ink bg-white font-pixel text-xl font-bold text-secondary">
            ?
          </span>
          <span className="min-w-0 flex-1">
            <h2 id="doubt-title" className="truncate font-pixel text-xl leading-tight font-bold">
              {t('question.title')}
            </h2>
            <span className="block truncate text-xs text-white/85">{t('question.subtitle')}</span>
          </span>
          {!empty && (
            <PixelButton variant="ghost" onClick={startOver} className="shrink-0 px-2.5 py-2 text-[10px]">
              {t('question.newChat')}
            </PixelButton>
          )}
          <PixelButton variant="ghost" onClick={onClose} aria-label={t('question.close')} title={t('question.close')} className="size-10 shrink-0 p-0">
            <svg aria-hidden="true" viewBox="0 0 7 7" shapeRendering="crispEdges" className="size-3.5 fill-current">
              {[0, 1, 2, 3, 4, 5, 6].map((step) => (
                <g key={step}>
                  <rect x={step} y={step} width="1" height="1" />
                  <rect x={6 - step} y={step} width="1" height="1" />
                </g>
              ))}
            </svg>
          </PixelButton>
        </header>

        <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="doubt-announcer">
          {spoken}
        </p>
        <div ref={log} role="log" aria-live="off" aria-busy={Boolean(pending)} aria-label={t('question.log')} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {empty && (
            <div className="border-2 border-ink bg-white p-3 text-sm text-ink shadow-pixel-secondary">
              <p>{t('question.hello')}</p>
              <p className="mt-2 text-muted">{t('question.helloCard')}</p>
            </div>
          )}

          {messages.map((message) =>
            message.role === 'user' ? (
              <StudentBubble key={message.id} message={message} />
            ) : (
              <TutorBubble key={message.id} text={message.content} stopped={message.stopped}>
                {message.card && (
                  <CardProposal
                    message={message}
                    creating={creating}
                    onAccept={chat.acceptCard}
                    onDismiss={chat.dismissCard}
                    onReopen={chat.reopenCard}
                    onOpenCase={onOpenCase}
                  />
                )}
              </TutorBubble>
            ),
          )}

          {pending &&
            (pending.text ? (
              <TutorBubble text={pending.text} streaming />
            ) : (
              <p role="status" className="flex items-center gap-2 text-sm text-muted">
                {t('question.thinking')}
                <TypingCaret />
              </p>
            ))}

          {error && (
            <div role="alert" className="border-2 border-ink bg-white p-3 text-sm shadow-pixel-muted">
              <p>{error}</p>
              <PixelButton variant="secondary" onClick={chat.retry} className="mt-2.5 px-2.5 py-1.5 text-[10px]">
                {t('question.retry')}
              </PixelButton>
            </div>
          )}

          {atCap && !pending && <p className="border-2 border-dashed border-ink bg-white p-3 text-sm text-ink">{t('question.capReached', { max: QUESTION_LIMITS.turns })}</p>}
        </div>

        <form
          className="border-t-2 border-ink bg-white p-3"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <label htmlFor="doubt-question" className="sr-only">
            {t('question.label')}
          </label>
          <textarea
            id="doubt-question"
            ref={input}
            rows={2}
            value={draft}
            disabled={atCap}
            maxLength={QUESTION_LIMITS.message}
            placeholder={t('question.placeholder')}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                submit()
              }
            }}
            className="block min-h-11 w-full resize-none border-2 border-ink bg-white px-2.5 py-2 text-sm text-ink placeholder:text-muted focus-visible:rounded-none focus-visible:outline-offset-0 disabled:bg-mist"
          />
          {withCode && (
            <>
              <label htmlFor="doubt-code" className="mt-2 block font-label text-[10px] text-ink">
                {t('question.codeLabel')}
              </label>
              <textarea
                id="doubt-code"
                rows={4}
                value={code}
                maxLength={QUESTION_LIMITS.code}
                spellCheck={false}
                placeholder={t('question.codePlaceholder')}
                onChange={(event) => setCode(event.target.value)}
                className="mt-1 block w-full resize-y border-2 border-ink bg-mist px-2.5 py-2 font-mono text-xs text-ink placeholder:text-muted focus-visible:rounded-none focus-visible:outline-offset-0"
              />
            </>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <PixelButton variant="ghost" onClick={() => setWithCode(!withCode)} aria-expanded={withCode} aria-controls={withCode ? 'doubt-code' : undefined} disabled={atCap} className="px-3 py-2 text-[10px]">
              {withCode ? t('question.removeCode') : t('question.addCode')}
            </PixelButton>
            <span className="text-xs text-muted">{t('question.turns', { used: turnsUsed(messages), max: QUESTION_LIMITS.turns })}</span>
            {pending ? (
              <PixelButton variant="secondary" onClick={chat.stop} title={t('question.stopTitle')} className="px-4 py-2.5">
                {t('question.stop')}
              </PixelButton>
            ) : (
              <PixelButton type="submit" disabled={!draft.trim() || atCap} className="px-4 py-2.5">
                {t('question.send')}
              </PixelButton>
            )}
          </div>
          <p className="mt-2 hidden text-xs text-muted sm:block">{t('question.keys')}</p>
        </form>
      </aside>
    </div>
  )
}
