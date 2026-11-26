import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const BUTTON =
  'min-h-11 cursor-pointer border-2 px-2.5 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#f2c14e] disabled:cursor-not-allowed disabled:opacity-50'
const TONES = {
  default: 'border-[#8f6bff] bg-[#2a1f5a] text-white',
  gold: 'border-[#0a0818] bg-[#f2c14e] text-[#1c1d26]',
  danger: 'border-[#ff5a6e] bg-[#2e0f1a] text-[#ffd3d9]',
}

// A panel button. why: the reason it is off, shown as text under it and tied to it with
// aria-describedby, so a disabled button always says why. busy: an action is running. quiet: the why is
// a plain state (nothing to save), not a problem, so it shows muted instead of red.
export function ActionButton({ children, onClick, why = null, busy = false, tone = 'default', pressed, quiet = false }) {
  const whyId = useId()
  return (
    <span className="inline-flex flex-col gap-0.5">
      <button
        type="button"
        disabled={busy || Boolean(why)}
        aria-describedby={why ? whyId : undefined}
        aria-pressed={pressed}
        onClick={onClick}
        className={`${BUTTON} ${TONES[tone]}`}
      >
        {children}
      </button>
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

// A small heading for a block inside a tab.
export function BlockTitle({ children, id }) {
  return (
    <h3 id={id} className="m-0 text-[11px] font-bold uppercase tracking-wide text-[#c3b2ff]">
      {children}
    </h3>
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
      <button type="button" tabIndex={-1} aria-label={closeLabel} onClick={onClose} className="absolute inset-0 cursor-default bg-[#05040c]/75" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`relative flex max-h-[95vh] ${width} flex-col gap-2 overflow-y-auto border-2 border-[#8a5cff] bg-[#120e26] p-2 font-mono text-xs text-[#ece8ff] shadow-[0_0_0_2px_#0a0818,6px_6px_0_rgba(0,0,0,.5)] focus-visible:outline-none`}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id={titleId} className="m-0 text-[13px] font-bold text-white">
            {title}
          </h2>
          <ActionButton onClick={onClose}>{closeLabel}</ActionButton>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
