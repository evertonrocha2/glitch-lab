import { useEffect, useId, useRef, useState } from 'react'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// The handle beside a block: a menu to move, duplicate or delete it. Deleting takes two steps (open
// the menu, pick "Delete block") and can be undone, so no single click ever wipes what was written.
// actions: [{ key, label, onSelect, disabled }].
export default function BlockHandle({ actions }) {
  const t = useT()
  const id = useId()
  const [open, setOpen] = useState(false)
  const button = useRef(null)
  const items = useRef([])

  useEffect(() => {
    if (open) items.current.find((item) => item && !item.disabled)?.focus()
  }, [open])

  function close(refocus = true) {
    setOpen(false)
    if (refocus) button.current?.focus()
  }

  function keyDown(event) {
    if (!open) return
    const enabled = items.current.filter((item) => item && !item.disabled)
    const index = enabled.indexOf(document.activeElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      enabled[(index + step + enabled.length) % enabled.length]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Tab') {
      close(false)
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the menu's keys, wherever focus is inside it
    <div
      className="relative shrink-0"
      onKeyDown={keyDown}
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={button}
        type="button"
        aria-label={t('notes.editor.blockMenu')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => setOpen((value) => !value)}
        className={`grid size-10 place-items-center text-muted transition-opacity hover:text-ink focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 ${open ? 'opacity-100' : 'opacity-40'}`}
      >
        <svg aria-hidden="true" viewBox="0 0 3 7" shapeRendering="crispEdges" className="h-3.5 w-1.5 fill-current">
          <rect x="0" y="0" width="1" height="1" />
          <rect x="2" y="0" width="1" height="1" />
          <rect x="0" y="3" width="1" height="1" />
          <rect x="2" y="3" width="1" height="1" />
          <rect x="0" y="6" width="1" height="1" />
          <rect x="2" y="6" width="1" height="1" />
        </svg>
      </button>
      {open && (
        <div
          id={`${id}-menu`}
          role="menu"
          aria-label={t('notes.editor.blockMenu')}
          className="absolute top-full right-0 z-30 mt-1 w-48 border-2 border-ink bg-white py-1 shadow-pixel"
        >
          {actions.map((action, index) => (
            <button
              key={action.key}
              ref={(element) => {
                items.current[index] = element
              }}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => {
                close(false)
                action.onSelect()
              }}
              className={`flex min-h-10 w-full items-center px-3 text-left text-sm disabled:text-muted/50 ${action.danger ? 'text-primary hover:bg-primary-soft' : 'text-ink hover:bg-mist'} focus-visible:bg-mist focus-visible:outline-none`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
