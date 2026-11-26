import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { matchPath, NavLink, useLocation } from 'react-router'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { MessagesNavLabel } from '../../chat/messages-nav-link/messages-nav-link.jsx'

// The signed-in pages, in the order the row shows them.
export const NAV_ITEMS = [
  { to: '/board', label: 'app.nav.board' },
  { to: '/exams/enem', label: 'app.nav.enem' },
  { to: '/daily', label: 'app.nav.daily' },
  { to: '/glitchdle', label: 'app.nav.glitchdle' },
  { to: '/mundo', label: 'world.nav' },
  { to: '/duel', label: 'duel.nav' },
  { to: '/notes', label: 'app.nav.notes' },
  { to: '/trail', label: 'app.nav.trail' },
  { to: '/articles', label: 'app.nav.articles' },
  { to: '/events', label: 'events.nav' },
  { to: '/communities', label: 'chat.nav.communities' },
  { to: '/messages', label: 'chat.nav.messages' },
  { to: '/progress', label: 'app.nav.progress' },
]

// How many links fit in a row `available` px wide, `gap` px apart. All of them when they fit;
// otherwise as many as fit with the "More" button (moreWidth) after them, maybe none.
export function fitCount(widths, available, moreWidth, gap) {
  const all = widths.reduce((sum, width, index) => sum + width + (index ? gap : 0), 0)
  if (all <= available) return widths.length
  let used = moreWidth
  let count = 0
  for (const width of widths) {
    if (used + width + gap > available) break
    used += width + gap
    count += 1
  }
  return count
}

const itemsOf = (menu) => [...(menu?.querySelectorAll('[role="menuitem"]') ?? [])]

const isAt = (to, pathname) => Boolean(matchPath({ path: to, end: false }, pathname))

// Shown links sit in the row; the ones that don't fit stay in it, invisible and out of the flow,
// so they can still be measured. The wide `before:` box is a bigger tap target.
// Mono, uppercase and muted; the current page lights up with a gold underline (the spike's nav).
const LINK = 'border-b-2 py-1.5 font-mono text-[13px] uppercase tracking-[0.06em] transition-colors'
const linkTone = (isActive) => (isActive ? 'border-gold text-ink' : 'border-transparent text-muted hover:text-ink')

const rowLinkClass = (isActive, shown) =>
  `flex shrink-0 items-center gap-1.5 ${LINK} before:absolute before:inset-x-0 before:-inset-y-2 ${
    shown ? 'relative' : 'invisible absolute top-0 left-0'
  } ${linkTone(isActive)}`

const menuLinkClass = ({ isActive }) =>
  `flex items-center gap-1.5 border-l-2 px-3 py-2 font-mono text-[13px] uppercase tracking-[0.06em] whitespace-nowrap focus:bg-raised ${
    isActive ? 'border-gold bg-raised text-ink' : 'border-transparent text-muted hover:bg-raised hover:text-ink'
  }`

function ItemLabel({ item, level, unread }) {
  const t = useT()
  if (item.to === '/messages') return <MessagesNavLabel unread={unread} />
  if (item.to !== '/progress') return t(item.label)
  return (
    <>
      {t(item.label)}{' '}
      {level != null ? (
        <>
          <span aria-hidden="true" className="bg-gold px-1 py-0.5 font-pixel text-[10px] leading-none tracking-normal text-gold-ink normal-case">
            {t('app.nav.levelChip', { level })}
          </span>
          <span className="sr-only">{t('app.nav.levelSr', { level })}</span>
        </>
      ) : (
        // Until the level loads, a gray chip of the same size holds its place in the row.
        <span aria-hidden="true" className="bg-line px-1 py-0.5 font-pixel text-[10px] leading-none tracking-normal text-transparent normal-case motion-safe:animate-skeleton">
          {t('app.nav.levelChip', { level: 1 })}
        </span>
      )}
    </>
  )
}

// The pages row of the app header. As many links as fit, in order; the rest go in a "More" menu
// at the end, so the row never scrolls sideways. level: the progress chip (null while loading).
// unread: unread conversations, read once by the header for both the row and the menu.
export default function AppNav({ level = null, unread = 0 }) {
  const t = useT()
  const { pathname } = useLocation()
  const navRef = useRef(null)
  const moreRef = useRef(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const focusOnOpen = useRef('first')
  const buttonId = useId()
  const menuId = useId()
  const [count, setCount] = useState(NAV_ITEMS.length)
  const [measured, setMeasured] = useState(false)
  // The page the menu was opened on: going to another page closes it.
  const [openAt, setOpenAt] = useState(null)

  const measure = useCallback(() => {
    const nav = navRef.current
    if (!nav || !moreRef.current) return
    const widths = [...nav.querySelectorAll(':scope > [data-nav-item]')].map((link) => link.getBoundingClientRect().width)
    const gap = Number.parseFloat(getComputedStyle(nav).columnGap) || 0
    setCount(fitCount(widths, nav.getBoundingClientRect().width, moreRef.current.getBoundingClientRect().width, gap))
    setMeasured(true)
  }, [])

  // Any render can change a width (the language, the level chip, the unread badge): measure before
  // the browser paints, so the row never shows overflowing. Unchanged counts don't re-render.
  useLayoutEffect(measure)

  // A resized window, or a web font arriving, changes what fits.
  useEffect(() => {
    const nav = navRef.current
    if (!nav || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure())
    observer.observe(nav)
    for (const child of nav.children) observer.observe(child)
    document.fonts?.ready.then(measure)
    return () => observer.disconnect()
  }, [measure])

  const hidden = NAV_ITEMS.slice(count)
  const overflow = hidden.length > 0
  const open = overflow && openAt === pathname
  const hiddenActive = hidden.some((item) => isAt(item.to, pathname))
  const hiddenUnread = unread > 0 && hidden.some((item) => item.to === '/messages')

  // Opening moves focus into the menu: the first item, or the last one after ArrowUp.
  useEffect(() => {
    if (!open) return
    const items = itemsOf(menuRef.current)
    ;(focusOnOpen.current === 'last' ? items.at(-1) : items[0])?.focus()
  }, [open])

  // A click outside closes the menu.
  useEffect(() => {
    if (!open) return
    const onPointer = (event) => moreRef.current && !moreRef.current.contains(event.target) && setOpenAt(null)
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  function closeToButton() {
    setOpenAt(null)
    buttonRef.current?.focus()
  }

  function onButtonKey(event) {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpenAt(null)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    focusOnOpen.current = event.key === 'ArrowUp' ? 'last' : 'first'
    if (!open) return setOpenAt(pathname)
    const items = itemsOf(menuRef.current)
    ;(event.key === 'ArrowUp' ? items.at(-1) : items[0])?.focus()
  }

  function onMenuKey(event) {
    const items = itemsOf(menuRef.current)
    const index = items.indexOf(document.activeElement)
    const go = (next) => {
      event.preventDefault()
      items[(next + items.length) % items.length]?.focus()
    }
    if (event.key === 'ArrowDown') go(index + 1)
    else if (event.key === 'ArrowUp') go(index - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(items.length - 1)
    else if (event.key === 'Escape') {
      event.preventDefault()
      closeToButton()
    } else if (event.key === 'Tab') {
      // Tab leaves the menu: from the button, the browser moves on to the next stop.
      closeToButton()
    }
  }

  return (
    <nav
      ref={navRef}
      aria-label={t('app.nav.main')}
      className={`relative flex min-w-0 flex-1 items-center gap-4 py-2 whitespace-nowrap sm:gap-6 ${measured ? '' : 'invisible'}`}
    >
      {NAV_ITEMS.map((item, index) => {
        const shown = index < count
        return (
          <NavLink
            key={item.to}
            to={item.to}
            data-nav-item=""
            aria-hidden={shown ? undefined : true}
            tabIndex={shown ? undefined : -1}
            className={({ isActive }) => rowLinkClass(isActive, shown)}
          >
            <ItemLabel item={item} level={level} unread={unread} />
          </NavLink>
        )
      })}
      <div ref={moreRef} aria-hidden={overflow ? undefined : true} className={`shrink-0 ${overflow ? 'relative' : 'invisible absolute top-0 left-0'}`}>
        <button
          ref={buttonRef}
          id={buttonId}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          tabIndex={overflow ? undefined : -1}
          onClick={() => {
            focusOnOpen.current = 'first'
            setOpenAt(open ? null : pathname)
          }}
          onKeyDown={onButtonKey}
          className={`relative flex items-center gap-1.5 ${LINK} before:absolute before:inset-x-0 before:-inset-y-2 ${linkTone(hiddenActive || open)}`}
        >
          {t('app.nav.more')}
          {hiddenUnread && (
            <>
              <span aria-hidden="true" className="size-2 bg-gold" />
              <span className="sr-only">{t('chat.nav.unread', { count: unread })}</span>
            </>
          )}
          <svg aria-hidden="true" viewBox="0 0 5 3" shapeRendering="crispEdges" className={`size-2.5 fill-current transition-transform ${open ? 'rotate-180' : ''}`}>
            <rect x="0" y="0" width="5" height="1" />
            <rect x="1" y="1" width="3" height="1" />
            <rect x="2" y="2" width="1" height="1" />
          </svg>
        </button>
        {open && (
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-labelledby={buttonId}
            onKeyDown={onMenuKey}
            className="kit-frame absolute top-full right-0 z-40 mt-3 min-w-48 p-1.5"
          >
            {hidden.map((item) => (
              <NavLink key={item.to} to={item.to} role="menuitem" tabIndex={-1} onClick={() => setOpenAt(null)} className={menuLinkClass}>
                <ItemLabel item={item} level={level} unread={unread} />
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
