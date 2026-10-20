import { useState } from 'react'

// Keeps content out of the DOM until asked for, so the student thinks before peeking.
export default function Reveal({ label, className = '', children }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-full border border-current/25 bg-white/70 px-3.5 py-1.5 text-sm font-semibold transition-colors duration-200 hover:bg-white ${className}`}
      >
        {open ? `Hide ${label}` : `Show ${label}`}
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}
