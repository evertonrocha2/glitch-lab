import { useEffect, useId, useRef, useState } from 'react'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// The handle beside a block: a menu to move, duplicate or delete it. Deleting takes two steps (open
// the menu, pick "Delete block") and can be undone, so no single click ever wipes what was written.
// actions: [{ key, label, onSelect, disabled, danger }], or { key, label, items: () => actions } for
// a list that replaces the menu (with a way back), built only when opened. label names the menu (a
// block's by default). buttonProps go on the handle itself (dragging it, a tooltip); a click whose
// default was prevented (the end of a drag) doesn't open the menu.
export default function BlockHandle({ actions, label, buttonProps = {} }) {
  const t = useT()
  const name = label ?? t('notes.editor.blockMenu')
  const id = useId()
  const [open, setOpen] = useState(false)
  // The key of the action whose list is showing, or null for the menu itself.
  const [sub, setSub] = useState(null)
  const button = useRef(null)
  const items = useRef([])
  // Back from a list, the action that opened it takes the focus again.
  const focusKey = useRef(null)

  const parent = sub && actions.find((action) => action.key === sub)
  const shown = parent ? [{ key: 'back', label: t('notes.editor.back'), back: true }, ...parent.items()] : actions

  useEffect(() => {
    if (!open) return
    const enabled = items.current.filter((item) => item && !item.disabled)
    // In a list, its first choice rather than "Back".
    const first = enabled.find((item) => item.dataset.key === focusKey.current) ?? enabled[sub ? 1 : 0] ?? enabled[0]
    first?.focus()
    focusKey.current = null
  }, [open, sub])

  function close(refocus = true) {
    setOpen(false)
    setSub(null)
    if (refocus) button.current?.focus()
  }

  function choose(action) {
    if (action.back) {
      focusKey.current = sub
      setSub(null)
      return
    }
    if (action.items) {
      setSub(action.key)
      return
    }
    close(false)
    action.onSelect()
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
        if (open && !event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
          setSub(null)
        }
      }}
    >
      <button
        ref={button}
        type="button"
        aria-label={name}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        {...buttonProps}
        onClick={(event) => {
          if (event.defaultPrevented) return
          setSub(null)
          setOpen((value) => !value)
        }}
        className={`grid size-10 place-items-center text-muted transition-opacity hover:text-ink focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 ${open ? 'opacity-100' : 'opacity-40'} ${buttonProps.className ?? ''}`}
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
          aria-label={parent ? parent.label : name}
          className={`absolute top-full right-0 z-30 mt-1 max-h-80 overflow-y-auto border-2 border-ink bg-white py-1 shadow-pixel ${parent ? 'w-64' : 'w-48'}`}
        >
          {shown.map((action, index) => (
            <button
              key={action.key}
              ref={(element) => {
                items.current[index] = element
              }}
              type="button"
              role="menuitem"
              data-key={action.key}
              disabled={action.disabled}
              aria-haspopup={action.items ? 'menu' : undefined}
              onClick={() => choose(action)}
              className={`flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm disabled:text-muted/50 ${action.back ? 'border-b-2 border-line font-label text-[10px] text-muted' : ''} ${action.danger ? 'text-primary hover:bg-primary-soft' : 'text-ink hover:bg-mist'} focus-visible:bg-mist focus-visible:outline-none`}
            >
              {action.back && <span aria-hidden="true">&lt;</span>}
              <span className="min-w-0 flex-1 truncate">{action.label}</span>
              {action.items && <span aria-hidden="true">&gt;</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
