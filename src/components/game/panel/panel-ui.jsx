import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Frame from '../ui/frame.jsx'

const BUTTON =
  'inline-flex min-h-11 cursor-pointer items-center justify-center px-3 pb-1.5 pt-2 font-pixel text-[10px] leading-tight disabled:cursor-not-allowed disabled:opacity-60'
// Each tone is a raised Frame with its own fill and bevel: plain, solid gold (the main action or the
// pressed choice) and a dark red one for what destroys or fights.
const TONES = {
  default: { style: undefined, text: 'text-[#e9e4ff] hover:text-white' },
  gold: { style: { '--f-bg': '#f2c14e', '--f-hi': '#fff1b0', '--f-lo': '#9a6a1c' }, text: 'text-[#120c22] hover:brightness-110' },
  danger: { style: { '--f-bg': '#4a1426', '--f-hi': '#ff5a6e', '--f-lo': '#22081a' }, text: 'text-[#ffd3d9] hover:text-white' },
}
// A button that is off for a reason drops its color: a dim gold or red fill read as mud, not as "off".
const OFF = { style: undefined, text: 'text-[#a89fd0]' }

// A panel button, a raised Frame like the Hero tab's. why: the reason it is off, shown as text under
// it and tied to it with aria-describedby, so a disabled button always says why. busy: an action is
// running. quiet: the why is a plain state (nothing to save), not a problem, so it shows muted.
export function ActionButton({ children, onClick, why = null, busy = false, tone = 'default', pressed, quiet = false }) {
  const whyId = useId()
  const look = why ? OFF : (TONES[tone] ?? TONES.default)
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Frame
        as="button"
        type="button"
        tone="raised"
        disabled={busy || Boolean(why)}
        aria-describedby={why ? whyId : undefined}
        aria-pressed={pressed}
        onClick={onClick}
        style={look.style}
        className={`${BUTTON} ${look.text}`}
      >
        {children}
      </Frame>
      {why && (
        <small id={whyId} className={`text-[10px] ${quiet ? 'text-[#9a93b8]' : 'text-[#ff9aa6]'}`}>
          {why}
        </small>
      )}
    </span>
  )
}

// Salvage destroys the item, so it asks once: the first press shows "Yes" and "Cancel".
export function ConfirmButton({ children, confirmLabel, cancelLabel, onConfirm, why = null, busy = false }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <ActionButton tone="danger" why={why} busy={busy} onClick={() => setAsking(true)}>
        {children}
      </ActionButton>
    )
  }
  return (
    <span className="inline-flex gap-1.5">
      <ActionButton
        tone="danger"
        busy={busy}
        onClick={() => {
          setAsking(false)
          onConfirm()
        }}
      >
        {confirmLabel}
      </ActionButton>
      <ActionButton busy={busy} onClick={() => setAsking(false)}>
        {cancelLabel}
      </ActionButton>
    </span>
  )
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

// A modal over the page: focus moves in and comes back to the opener, Tab stays inside, Escape and
// the dimmed backdrop close it.
export function GameDialog({ titleId, title, closeLabel, onClose, children, width = 'w-[min(760px,95vw)]' }) {
  const panel = useRef(null)

  useEffect(() => {
    const opener = document.activeElement
    panel.current?.focus()
    return () => opener?.focus?.()
  }, [])

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = [...panel.current.querySelectorAll(FOCUSABLE)]
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2">
      <button type="button" tabIndex={-1} aria-label={closeLabel} onClick={onClose} className="absolute inset-0 cursor-default bg-[#05040c]/80" />
      <Frame
        ref={panel}
        tone="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`relative flex max-h-[calc(100dvh-16px)] ${width} flex-col p-1 font-mono text-xs text-[#e9e4ff] shadow-[6px_6px_0_rgba(0,0,0,.5)] focus-visible:outline-none`}
      >
        <header className="flex items-center justify-between gap-2 border-b-2 border-[#0a0818] px-2 pb-2 pt-2 shadow-[0_2px_0_#3e3170]">
          <h2 id={titleId} className="m-0 font-pixel text-[15px] font-normal uppercase leading-none tracking-[0.06em] text-[#f2c14e] [text-shadow:2px_2px_0_#120c22]">
            {title}
          </h2>
          <ActionButton onClick={onClose}>{closeLabel}</ActionButton>
        </header>
        <div className="gw-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-2">{children}</div>
      </Frame>
    </div>,
    document.body,
  )
}
