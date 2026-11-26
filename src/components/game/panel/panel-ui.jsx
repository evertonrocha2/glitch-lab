import { useId, useState } from 'react'

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
