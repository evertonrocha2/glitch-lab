import { useState } from 'react'
import { useT } from '../lib/i18n/I18nProvider.jsx'
import PixelButton from './pixel/PixelButton.jsx'

// Keeps content out of the DOM until asked for, so the student thinks before peeking.
export default function Reveal({ label, className = '', children }) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-5">
      <PixelButton
        variant="ghost"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`px-3 py-1.5 text-xs ${className}`}
      >
        {open ? t('board.reveal.hide', { label }) : t('board.reveal.show', { label })}
      </PixelButton>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}
