import { useEffect, useId, useRef, useState } from 'react'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'

const Caret = () => (
  <svg aria-hidden="true" viewBox="0 0 5 3" shapeRendering="crispEdges" className="h-1.5 w-2.5 fill-current">
    <rect x="0" y="0" width="5" height="1" />
    <rect x="1" y="1" width="3" height="1" />
    <rect x="2" y="2" width="1" height="1" />
  </svg>
)

const ITEM_CLASS =
  'flex min-h-10 w-full items-start gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-mist focus:bg-primary-soft focus-visible:outline-none disabled:text-muted/50'
const itemsIn = (element) => [...(element?.querySelectorAll('[role^="menuitem"]:not([disabled])') ?? [])]

// A button with a small menu under it, keyboard like any menu (arrows, Home, End, Escape; Tab
// leaves). groups: [{ key, label?, items: [{ key, label, sub?, checked?, disabled?, keepOpen?, onSelect }] }].
// An item with `checked` is a radio item; keepOpen leaves the menu open after picking it (a choice
// made before the action). align 'end' lines the menu up with the button's right edge, from sm up:
// on a phone the buttons wrap to the left, so it opens rightward and stays on screen. footer: a line under the items. Button props (aria-label, onFocus...)
// go through `button`.
export default function MenuButton({ children, heading, menuLabel, groups, footer, button = {}, variant = 'ghost', className = 'px-3 py-2', menuClassName = 'w-64', align = 'end' }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const wrapper = useRef(null)
  const trigger = useRef(null)
  const menu = useRef(null)

  const focusItem = (index) => {
    const list = itemsIn(menu.current)
    list[(index + list.length) % list.length]?.focus()
  }

  useEffect(() => {
    if (!open) return
    const list = itemsIn(menu.current)
    ;(list.find((item) => item.getAttribute('aria-checked') === 'true') ?? list[0])?.focus()
    // A click anywhere else closes the menu.
    const onPointerDown = (event) => {
      if (!wrapper.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function close() {
    setOpen(false)
    trigger.current?.focus()
  }

  function menuKey(event) {
    const list = itemsIn(menu.current)
    const index = list.indexOf(document.activeElement)
    const moves = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: list.length - 1 }
    if (event.key in moves) {
      event.preventDefault()
      focusItem(moves[event.key])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  function pick(item) {
    if (item.keepOpen) {
      item.onSelect()
      return
    }
    close()
    item.onSelect()
  }

  return (
    <div ref={wrapper} className="relative">
      <PixelButton
        ref={trigger}
        variant={variant}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        {...button}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
          }
        }}
        className={className}
      >
        {children}
        <Caret />
      </PixelButton>
      {open && (
        <div
          className={`absolute top-full z-30 mt-2 max-w-[calc(100vw-2.5rem)] border-2 border-ink bg-white shadow-pixel ${align === 'end' ? 'left-0 sm:right-0 sm:left-auto' : 'left-0'} ${menuClassName}`}
        >
          {heading && <p className="border-b-2 border-ink bg-mist px-3 py-1.5 font-label text-[10px] text-muted">{heading}</p>}
          <div ref={menu} id={id} role="menu" aria-label={menuLabel} onKeyDown={menuKey} className="py-1">
            {groups.map((group, groupIndex) => (
              // biome-ignore lint/a11y/useSemanticElements: a group inside a menu, as ARIA names it
              <div key={group.key} role="group" aria-label={group.label} className={groupIndex ? 'mt-1 border-t-2 border-dashed border-line pt-1' : ''}>
                {group.label && (
                  <p aria-hidden="true" className="px-3 pt-1.5 pb-0.5 font-label text-[10px] text-muted">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const props = { type: 'button', tabIndex: -1, disabled: item.disabled, onClick: () => pick(item), className: ITEM_CLASS }
                  const text = (
                    <span key="text" className="min-w-0 flex-1">
                      <span className="block font-semibold wrap-break-word">{item.label}</span>
                      {item.sub && <span className="block text-xs text-muted">{item.sub}</span>}
                    </span>
                  )
                  if (item.checked === undefined) {
                    return (
                      <button key={item.key} {...props} role="menuitem">
                        {text}
                      </button>
                    )
                  }
                  return (
                    <button key={item.key} {...props} role="menuitemradio" aria-checked={item.checked}>
                      <span aria-hidden="true" className={`mt-1 size-2.5 shrink-0 border-2 border-ink ${item.checked ? 'bg-primary' : 'bg-white'}`} />
                      {text}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          {footer && <p className="border-t-2 border-ink bg-mist px-3 py-1.5 text-xs text-muted">{footer}</p>}
        </div>
      )}
    </div>
  )
}
