import { useEffect, useId, useRef, useState } from 'react'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../pixel/PixelButton.jsx'

const FORMATS = [
  { format: 'md', ext: '.md' },
  { format: 'png', ext: '.png' },
  { format: 'pdf', ext: '.pdf' },
]

// "Export" with a small menu of file types. onExport(format) may return a promise; the button
// says "Exporting..." until it settles. Keyboard: arrows, Home, End, Escape, like any menu.
// buttonClassName sizes the button to sit next to its neighbors.
export default function ExportMenu({ onExport, buttonClassName = 'px-3 py-2' }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const id = useId()
  const wrapper = useRef(null)
  const button = useRef(null)
  const items = useRef([])

  const focusItem = (index) => items.current[(index + FORMATS.length) % FORMATS.length]?.focus()

  useEffect(() => {
    if (open) focusItem(0)
  }, [open])

  // A click anywhere else closes the menu.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      if (!wrapper.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function close() {
    setOpen(false)
    button.current?.focus()
  }

  async function pick(format) {
    close()
    setBusy(true)
    try {
      await onExport(format)
    } finally {
      setBusy(false)
    }
  }

  function menuKey(event) {
    const index = items.current.indexOf(document.activeElement)
    const moves = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: FORMATS.length - 1 }
    if (event.key in moves) {
      event.preventDefault()
      focusItem(moves[event.key])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapper} className="relative">
      <PixelButton
        ref={button}
        variant="ghost"
        // aria-disabled keeps focus on the button while the file is made (disabled would drop it).
        aria-disabled={busy || undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => !busy && setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !busy) {
            event.preventDefault()
            setOpen(true)
          }
        }}
        className={`${buttonClassName} ${busy ? 'cursor-progress text-muted' : ''}`}
      >
        {busy ? t('notes.export.busy') : t('notes.export.button')}
        {!busy && (
          <svg aria-hidden="true" viewBox="0 0 5 3" shapeRendering="crispEdges" className="h-1.5 w-2.5 fill-current">
            <rect x="0" y="0" width="5" height="1" />
            <rect x="1" y="1" width="3" height="1" />
            <rect x="2" y="2" width="1" height="1" />
          </svg>
        )}
      </PixelButton>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-2 w-48 border-2 border-ink bg-white shadow-pixel sm:right-0 sm:left-auto">
          <p className="border-b-2 border-ink bg-mist px-3 py-1.5 font-label text-[10px] text-muted">{t('notes.export.heading')}</p>
          <div id={id} role="menu" aria-label={t('notes.export.menu')} onKeyDown={menuKey} className="py-1">
            {FORMATS.map((item, index) => (
              <button
                key={item.format}
                ref={(element) => {
                  items.current[index] = element
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => pick(item.format)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold text-ink hover:bg-mist focus:bg-primary-soft focus-visible:outline-none"
              >
                {t(`notes.export.${item.format}`)}
                <span className="font-mono text-xs font-normal text-muted">{item.ext}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
