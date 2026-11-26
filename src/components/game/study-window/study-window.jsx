import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { STUDY_FRAME_NAME, withEmbed } from '../../../app/embed.js'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import GameIcon from '../icons/game-icon.jsx'
import { studyPageOf, studyPages } from '../study-cta.js'
import Frame, { Chip } from '../ui/frame.jsx'
import { clampRect, loadRect, saveRect } from './geometry.js'

const WIDE = '(min-width: 1024px)'
// Above the game's phone drawer (z-40), under its dialogs (z-50): a creator or an away summary
// opened while studying still shows on top.
const LAYER = 'z-[45]'
// One arrow key press moves or resizes this far; with Shift, four times as far.
const STEP = 16
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2c14e]'

function useWide() {
  const read = () => {
    try {
      return window.matchMedia ? window.matchMedia(WIDE).matches : true
    } catch {
      return true
    }
  }
  const [wide, setWide] = useState(read)
  useEffect(() => {
    let list = null
    try {
      list = window.matchMedia?.(WIDE) ?? null
    } catch {
      list = null
    }
    if (!list?.addEventListener) return undefined
    const onChange = () => setWide(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [])
  return wide
}

const viewport = () => [window.innerWidth, window.innerHeight]

// The study window (StudyWindowProvider mounts it): a study page in a same-origin iframe with
// ?embed=1, over the game, which stays visible and usable behind it (not a modal).
// Desktop: a floating window, dragged by its title bar (arrow keys too), resized from its corner,
// remembered per browser. Phone: a bottom sheet with a handle. Escape minimizes it to a pill that
// keeps the page loaded; only the close button drops the page.
//   href: the page shown. minimized: shown as the pill. opener: a ref to what gets focus on close.
//   onNavigate(href): the switcher picked a page. onMinimize, onRestore, onClose.
export default function StudyWindow({ href, minimized, opener, onNavigate, onMinimize, onRestore, onClose }) {
  const { t, locale } = useI18n()
  const wide = useWide()
  const [rect, setRect] = useState(() => loadRect(...viewport()))
  const [dragging, setDragging] = useState(false)
  const drag = useRef(null)
  const bar = useRef(null)
  const pill = useRef(null)

  useEffect(() => {
    if (wide) saveRect(rect)
  }, [rect, wide])

  useEffect(() => {
    const onResize = () => setRect((current) => clampRect(current, ...viewport()))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Focus follows the window: into its title bar (the sheet's handle) when it shows, onto the pill
  // when minimized, and back to what opened it when it closes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: wide swaps the window for the sheet, a new element to focus.
  useEffect(() => {
    if (minimized) pill.current?.focus()
    else bar.current?.focus()
  }, [minimized, wide])
  useEffect(
    () => () => {
      const element = opener.current
      if (element?.isConnected) element.focus?.()
    },
    [opener],
  )

  const page = studyPageOf(href, locale)
  const pageName = page ? t(`studyWindow.page.${page.id}`) : t('studyWindow.page.other')
  const title = t('studyWindow.title')

  // Keys typed in the window (outside its page, which is its own document) never reach the game's
  // shortcuts. Escape minimizes, so a stray key never loses the page.
  function onKeyDown(event) {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onMinimize()
    }
  }

  // kind 'move' shifts the window, 'size' grows it from the bottom-right corner (never past the screen).
  const shifted = (from, kind, dx, dy) => {
    const [vw, vh] = viewport()
    if (kind === 'move') return clampRect({ ...from, x: from.x + dx, y: from.y + dy }, vw, vh)
    return clampRect({ ...from, w: Math.min(from.w + dx, vw - from.x - 8), h: Math.min(from.h + dy, vh - from.y - 8) }, vw, vh)
  }

  const handlers = (kind) => ({
    onPointerDown(event) {
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      drag.current = { kind, x: event.clientX, y: event.clientY, from: rect }
      setDragging(true)
    },
    onPointerMove(event) {
      const current = drag.current
      if (!current || current.kind !== kind) return
      setRect(shifted(current.from, kind, event.clientX - current.x, event.clientY - current.y))
    },
    onPointerUp() {
      drag.current = null
      setDragging(false)
    },
    onPointerCancel() {
      drag.current = null
      setDragging(false)
    },
    onKeyDown(event) {
      const arrow = ARROWS[event.key]
      if (!arrow) return
      event.preventDefault()
      const step = event.shiftKey ? STEP * 4 : STEP
      setRect((current) => shifted(current, kind, arrow[0] * step, arrow[1] * step))
    },
  })

  const picker = <PagePicker href={href} page={page} locale={locale} t={t} onNavigate={onNavigate} />
  const frame = (
    <Frame tone="inset" className="relative min-h-0 flex-1 p-1">
      {/* While dragging, the page lets the pointer through, so it can't swallow the drag. */}
      <iframe
        name={STUDY_FRAME_NAME}
        src={withEmbed(href)}
        title={t('studyWindow.frame', { page: pageName })}
        className={`block size-full border-0 bg-white ${dragging ? 'pointer-events-none' : ''}`}
      />
    </Frame>
  )

  const shared = {
    // A label, not aria-labelledby: the name must hold while the window is minimized (hidden).
    'aria-label': t('studyWindow.title'),
    hidden: minimized,
    onKeyDown,
  }

  const box = wide ? (
    <Frame
      as="section"
      tone="panel"
      {...shared}
      className={`fixed ${LAYER} ${minimized ? 'hidden' : 'flex'} flex-col gap-1 p-1 font-mono text-xs text-[#e9e4ff] shadow-[6px_6px_0_rgba(5,4,12,.55)]`}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      <header className="flex items-center gap-1.5 border-b-2 border-[#0a0818] px-1 pt-1 pb-1.5 shadow-[0_2px_0_#3e3170]">
        <button
          ref={bar}
          type="button"
          aria-label={t('studyWindow.move')}
          {...handlers('move')}
          className={`flex min-h-10 min-w-0 flex-1 cursor-grab touch-none select-none items-center gap-2 px-1 text-left active:cursor-grabbing ${FOCUS_RING}`}
        >
          <Grip />
          <GameIcon name="book" size={1} />
          <span className="font-pixel text-[13px] uppercase leading-none tracking-[0.06em] text-[#f2c14e] [text-shadow:2px_2px_0_#120c22]">
            {title}
          </span>
          <Chip tone="ok" className="ml-1 hidden truncate min-[1280px]:inline-flex">
            {t('studyWindow.hint')}
          </Chip>
        </button>
        {picker}
        <IconButton label={t('studyWindow.minimize')} onClick={onMinimize} glyph="min" />
        <IconButton label={t('studyWindow.close')} onClick={onClose} glyph="x" />
      </header>
      {frame}
      <button
        type="button"
        aria-label={t('studyWindow.resize')}
        {...handlers('size')}
        className={`absolute right-0 bottom-0 z-10 grid size-6 cursor-nwse-resize touch-none place-items-end p-1 ${FOCUS_RING}`}
      >
        <Corner />
      </button>
    </Frame>
  ) : (
    <Frame
      as="section"
      tone="panel"
      {...shared}
      className={`fixed inset-x-0 bottom-0 ${LAYER} ${minimized ? 'hidden' : 'flex'} h-[75dvh] flex-col gap-1 px-1.5 pb-1.5 font-mono text-xs text-[#e9e4ff] shadow-[0_-4px_0_rgba(5,4,12,.45)]`}
    >
      <button ref={bar} type="button" aria-label={t('studyWindow.handle')} onClick={onMinimize} className={`flex min-h-9 shrink-0 cursor-pointer items-center justify-center ${FOCUS_RING}`}>
        <i aria-hidden="true" className="block h-1.5 w-14 border-2 border-[#0a0818] bg-[#574a96]" />
      </button>
      <header className="flex items-center gap-1.5 px-1 pb-1">
        <GameIcon name="book" size={1} />
        <span className="font-pixel text-[12px] uppercase leading-none tracking-[0.06em] text-[#f2c14e]">
          {title}
        </span>
        <span className="ml-auto flex min-w-0 items-center gap-1.5">
          {picker}
          <IconButton label={t('studyWindow.close')} onClick={onClose} glyph="x" />
        </span>
      </header>
      {frame}
    </Frame>
  )

  return createPortal(
    <>
      {box}
      {minimized && <Pill ref={pill} title={title} t={t} onRestore={onRestore} onClose={onClose} />}
    </>,
    document.body,
  )
}

// The page switcher: the pages that give acertos; a page it doesn't list (opened from a link inside
// the game) shows first as "This page".
function PagePicker({ href, page, locale, t, onNavigate }) {
  const pages = studyPages(locale)
  const value = page ? page.href : href
  return (
    <Frame tone="inset" className="min-w-0 shrink p-1">
      <select
        aria-label={t('studyWindow.pick')}
        value={value}
        onChange={(event) => onNavigate(event.target.value)}
        className={`block h-8 max-w-40 cursor-pointer bg-transparent px-1 font-pixel text-[10px] text-[#e9e4ff] ${FOCUS_RING}`}
      >
        {!page && <option value={href}>{t('studyWindow.page.other')}</option>}
        {pages.map((each) => (
          <option key={each.id} value={each.href} className="bg-[#1b1433] text-[#e9e4ff]">
            {t(`studyWindow.page.${each.id}`)}
          </option>
        ))}
      </select>
    </Frame>
  )
}

function IconButton({ label, onClick, glyph }) {
  return (
    <Frame as="button" type="button" tone="raised" aria-label={label} title={label} onClick={onClick} className="grid size-10 shrink-0 cursor-pointer place-items-center text-[#e9e4ff] hover:text-white">
      {glyph === 'x' ? <Cross /> : <i aria-hidden="true" className="mt-2 block h-0.5 w-3 bg-current" />}
    </Frame>
  )
}

// The minimized window: a gold pill at the bottom right (above the phone drawer) that brings the page
// back, and its close button.
function Pill({ ref, title, t, onRestore, onClose }) {
  return (
    <Frame
      tone="gold"
      className={`fixed right-3 ${LAYER} flex items-center gap-1 p-1 shadow-[4px_4px_0_rgba(5,4,12,.55)]`}
      style={{ bottom: 'calc(var(--dock-h, 0px) + 12px)' }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button ref={ref} type="button" aria-label={t('studyWindow.restore')} onClick={onRestore} className={`flex min-h-10 cursor-pointer items-center gap-2 px-2 font-pixel text-[11px] uppercase text-[#f2c14e] hover:text-white ${FOCUS_RING}`}>
        <GameIcon name="book" size={1} />
        {title}
      </button>
      <IconButton label={t('studyWindow.close')} onClick={onClose} glyph="x" />
    </Frame>
  )
}

// Pixel glyphs drawn with 2px squares, like the drawer's chevron.
function Cross() {
  const dots = [
    [-4, -4],
    [-2, -2],
    [2, 2],
    [4, 4],
    [4, -4],
    [2, -2],
    [-2, 2],
    [-4, 4],
  ]
  return <i aria-hidden="true" className="block size-0.5 bg-current" style={{ boxShadow: dots.map(([x, y]) => `${x}px ${y}px 0 currentColor`).join(', ') }} />
}

// Six dots: the title bar is a handle.
function Grip() {
  const dots = [
    [0, 4],
    [0, 8],
    [4, 0],
    [4, 4],
    [4, 8],
  ]
  return <i aria-hidden="true" className="mr-1 block size-0.5 shrink-0 -translate-y-1 bg-[#a89fd0]" style={{ boxShadow: dots.map(([x, y]) => `${x}px ${y}px 0 #a89fd0`).join(', ') }} />
}

// The resize corner: a stepped triangle of dots.
function Corner() {
  const dots = [
    [-4, 0],
    [-8, 0],
    [0, -4],
    [-4, -4],
    [0, -8],
  ]
  return <i aria-hidden="true" className="block size-0.5 bg-[#a89fd0]" style={{ boxShadow: dots.map(([x, y]) => `${x}px ${y}px 0 #a89fd0`).join(', ') }} />
}
