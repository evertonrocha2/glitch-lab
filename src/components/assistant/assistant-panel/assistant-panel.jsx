import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ASSISTANT_LIMITS, pageKind } from '../../../../shared/assistant.js'
import { AuthError, startChallenge } from '../../../lib/api.js'
import { useAssistant } from '../../../lib/assistant/assistant-provider.jsx'
import { pageFromLocation } from '../../../lib/assistant/conversation.js'
import { useAuth } from '../../../lib/auth/auth-provider.jsx'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useStudyTimer } from '../../../lib/timer/study-timer-provider.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import PixelLogo from '../../ui/pixel-logo/pixel-logo.jsx'
import { AssistantBubble, StreamingBubble, UserBubble } from '../assistant-message/assistant-message.jsx'
import LabAvatar from '../lab-avatar/lab-avatar.jsx'
import { suggestionsFor } from '../names.js'
import ThinkingSteps from '../thinking-steps/thinking-steps.jsx'

const FOCUSABLE = 'button:not([disabled]), a[href], textarea:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

// Alt+A, or Ctrl+/ (Cmd+/ on a Mac). The physical A key, since Option+A types a letter on a Mac.
export const isAssistantShortcut = (event) =>
  (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyA') || ((event.ctrlKey || event.metaKey) && event.key === '/')

function Dialog() {
  const assistant = useAssistant()
  const { messages, pending, error, announcement, close } = assistant
  const { getToken, signOut } = useAuth()
  const timer = useStudyTimer()
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const page = pageFromLocation(location.pathname, assistant.focus)
  const [draft, setDraft] = useState('')
  const [actionError, setActionError] = useState('')
  const [acting, setActing] = useState(false)
  const panel = useRef(null)
  const input = useRef(null)
  const log = useRef(null)

  // Focus goes to the question box and comes back to whatever opened the panel.
  useEffect(() => {
    const opener = document.activeElement
    input.current?.focus()
    return () => opener?.focus?.()
  }, [])

  // Newest message in view, and the newest words while an answer streams in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these are the moments the log grows.
  useEffect(() => {
    log.current?.scrollTo?.({ top: log.current.scrollHeight })
  }, [messages.length, pending, error])

  function submit(text) {
    setActionError('')
    if (assistant.send(text, page)) setDraft('')
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      // Only this panel closes, not a case panel open underneath.
      event.stopPropagation()
      close()
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

  async function runAction(action) {
    setActionError('')
    if (action.type === 'start_timer') {
      if (!timer.running) timer.start()
      close()
      return
    }
    if (action.type !== 'train_case') {
      close()
      navigate(action.href)
      return
    }
    // Same as "Train this" on the board: resumes the open challenge, or writes a new one.
    setActing(true)
    try {
      const challenge = await startChallenge(action.target, await getToken())
      close()
      navigate(`/gym/${challenge.id}`)
    } catch (err) {
      if (err instanceof AuthError) await signOut()
      else setActionError(err.message)
    } finally {
      setActing(false)
    }
  }

  const empty = messages.length === 0 && !pending

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Clicking the dimmed page closes the panel; keyboard users have Escape and the Close button. */}
      <button type="button" tabIndex={-1} aria-label={t('app.assistant.closeBackdrop')} onClick={close} className="absolute inset-0 cursor-default bg-ink/40" />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assistant-title"
        // Focusable, so clicking plain text keeps focus inside and Escape still reaches the panel.
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative flex h-full w-full flex-col border-ink bg-mist sm:w-105 sm:border-r-2 sm:shadow-[6px_0_0_var(--color-primary)] motion-safe:animate-panel-in"
      >
        {/* Just the title and a close button: "New chat" lives by the composer, so the title never gets squeezed. */}
        <header className="flex items-center gap-3 border-b-2 border-ink bg-primary px-4 py-3 text-white">
          <span className="grid size-10 shrink-0 place-items-center border-2 border-ink bg-white">
            <LabAvatar className="size-7 border-0" />
          </span>
          <span className="min-w-0 flex-1">
            <h2 id="assistant-title" className="font-pixel text-xl leading-tight font-bold">
              {t('app.assistant.title')}
            </h2>
            <span className="block text-xs text-white/85">{t('app.assistant.subtitle')}</span>
          </span>
          <PixelButton variant="ghost" onClick={close} aria-label={t('app.assistant.close')} title={t('app.assistant.closeTitle')} className="size-10 shrink-0 p-0 text-lg">
            {/* A pixel X: the pixel font draws "×" too small to see. */}
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

        {/* Screen readers hear each answer once, when it is done, from here: the log itself stays
            quiet, or it would read every streamed word. */}
        <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="assistant-announcer">
          {announcement}
        </p>
        <div
          ref={log}
          role="log"
          aria-live="off"
          aria-busy={Boolean(pending)}
          aria-label={t('app.assistant.log')}
          className="flex-1 space-y-4 overflow-y-auto px-4 py-5"
        >
          {empty && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5">
                <LabAvatar />
                <div className="min-w-0 flex-1 border-2 border-ink bg-white p-3 text-sm shadow-pixel">
                  <p>{t('app.assistant.hello')}</p>
                </div>
              </div>
              <div>
                <p className="font-label text-[10px] text-muted">{t('app.assistant.tryAsking')}</p>
                <ul aria-label={t('app.assistant.suggestions')} className="mt-2 flex flex-wrap gap-2">
                  {suggestionsFor(t, pageKind(location.pathname)).map((text) => (
                    <li key={text}>
                      <button
                        type="button"
                        onClick={() => submit(text)}
                        className="border-2 border-ink bg-white px-2.5 py-1.5 text-left text-xs text-ink transition-colors hover:bg-primary-soft"
                      >
                        {text}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {messages.map((message) =>
            message.role === 'user' ? (
              <UserBubble key={message.id} message={message} />
            ) : (
              <AssistantBubble key={message.id} message={message} onAction={runAction} busy={acting} />
            ),
          )}

          {pending &&
            (pending.parts?.length ? (
              <StreamingBubble parts={pending.parts} />
            ) : (
              <ThinkingSteps question={pending.question} page={pending.page} steps={pending.steps} />
            ))}

          {(error || actionError) && (
            <div role="alert" className="border-2 border-ink bg-white p-3 text-sm shadow-pixel-muted">
              <p>{error || actionError}</p>
              {error && (
                <PixelButton variant="secondary" onClick={() => assistant.retry(page)} className="mt-2.5 px-2.5 py-1.5 text-[10px]">
                  {t('app.assistant.retry')}
                </PixelButton>
              )}
            </div>
          )}
        </div>

        <form
          className="border-t-2 border-ink bg-white p-3"
          onSubmit={(event) => {
            event.preventDefault()
            submit(draft)
          }}
        >
          <label htmlFor="assistant-question" className="sr-only">
            {t('app.assistant.question')}
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="assistant-question"
              ref={input}
              rows={2}
              value={draft}
              maxLength={ASSISTANT_LIMITS.content}
              placeholder={t('app.assistant.placeholder')}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  submit(draft)
                }
              }}
              className="min-h-11 flex-1 resize-none border-2 border-ink bg-white px-2.5 py-2 text-sm text-ink placeholder:text-muted focus-visible:rounded-none focus-visible:outline-offset-0"
            />
            {pending ? (
              <PixelButton variant="secondary" onClick={assistant.stop} title={t('app.assistant.stopTitle')} className="px-3 py-2.5">
                {t('app.assistant.stop')}
              </PixelButton>
            ) : (
              <PixelButton type="submit" disabled={!draft.trim()} className="px-3 py-2.5">
                {t('app.assistant.send')}
              </PixelButton>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-muted">{t('app.assistant.keys')}</p>
            <PixelButton variant="ghost" onClick={assistant.newChat} disabled={empty} className="shrink-0 px-2.5 py-1.5 text-[10px]">
              {t('app.assistant.newChat')}
            </PixelButton>
          </div>
        </form>
      </aside>
    </div>
  )
}

// Mounted on every signed-in page (in AppShell): the keyboard shortcut and, when open, the panel.
export default function AssistantPanel() {
  const { isOpen, toggle } = useAssistant()

  useEffect(() => {
    const onKey = (event) => {
      if (!isAssistantShortcut(event)) return
      event.preventDefault()
      toggle()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [toggle])

  return isOpen ? <Dialog /> : null
}

// The header button that opens it.
export function AssistantButton() {
  const { open } = useAssistant()
  const t = useT()
  return (
    <PixelButton variant="primary" onClick={open} aria-label={t('app.assistant.open')} aria-keyshortcuts="Alt+A Control+/" className="min-w-10 px-1.5 py-1.5 sm:px-3 sm:py-2">
      <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center border border-ink bg-white">
        <PixelLogo className="size-3.5" />
      </span>
      {/* Phones and tablets show just the icon so the top row fits; the name stays "Lab assistant". */}
      <span className="hidden lg:inline">{t('app.assistant.open')}</span>
    </PixelButton>
  )
}
