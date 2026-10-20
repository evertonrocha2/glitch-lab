import { useState } from 'react'

// Keeps content out of the DOM until asked for, so the student thinks before peeking.
export default function Reveal({ label, children }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="text-sm font-medium text-amber-400 hover:text-amber-300"
      >
        {open ? `Hide ${label}` : `Show ${label}`}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}
