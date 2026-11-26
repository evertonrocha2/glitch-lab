import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GEMS, itemStats } from '../../../../shared/game/items.js'
import { RARITY_COLORS, statDiff, useItemText } from '../item-tooltip/item-text.js'
import { ActionButton } from '../panel/panel-ui.jsx'
import Frame, { Chip } from '../ui/frame.jsx'
import { RARITY_TRIM } from '../ui/tokens.js'
import { boxOf, placeBeside } from './place.js'

// Item cells talk to two layers here: a compact tooltip on hover or keyboard focus (ItemTip), and a
// popover with the full card and its actions on click (ItemPopover). Both float beside the cell in
// a portal (the panel scrolls and would clip them), stay inside the console and the viewport and
// never cover the cell. Under 1024px the popover is a bottom sheet instead.

const WIDE = '(min-width: 1024px)'
const POPOVER_WIDTH = 288
const TIP_WIDTH = 216
const GEM_TRIM = '#4fd1c5'
const GEM_TEXT = '#7fe9ff'
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

// True from 1024px up. Without matchMedia (tests) it answers true.
export function useWide() {
  const read = () => (typeof window === 'undefined' || !window.matchMedia ? true : window.matchMedia(WIDE).matches)
  const [wide, setWide] = useState(read)
  useEffect(() => {
    const list = window.matchMedia?.(WIDE)
    if (!list?.addEventListener) return undefined
    const onChange = () => setWide(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [])
  return wide
}

// The frame a floating box must stay in: the nearest [data-popover-bounds] around the cell, else the
// outermost panel Frame (the console on desktop), else none (the viewport alone).
export function frameAround(element) {
  let frame = null
  for (let node = element?.parentElement; node; node = node.parentElement) {
    if (node.hasAttribute('data-popover-bounds')) return node
    if (node.classList.contains('gw-frame') && node.dataset.tone === 'panel') frame = node
  }
  return frame
}

// Keeps `box` placed beside the anchor cell: measures after each render and on scroll or resize
// anywhere (the panel scrolls inside the page), and answers the side it took and the box's style.
function usePlacement(anchor, box, width, gap) {
  const [place, setPlace] = useState(null)
  const [tick, setTick] = useState(0)
  const anchorRef = useRef(anchor)
  anchorRef.current = anchor

  useEffect(() => {
    const bump = () => setTick((now) => now + 1)
    window.addEventListener('scroll', bump, true)
    window.addEventListener('resize', bump)
    return () => {
      window.removeEventListener('scroll', bump, true)
      window.removeEventListener('resize', bump)
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs after every render on purpose, so a content change (a confirm opening) re-measures; tick forces it on scroll.
  useLayoutEffect(() => {
    const cell = anchorRef.current()
    const element = box.current
    if (!cell || !element) return
    const frame = frameAround(cell)
    const bounds = boxOf(frame?.getBoundingClientRect() ?? null, { width: window.innerWidth, height: window.innerHeight })
    const next = placeBeside(cell.getBoundingClientRect(), { width, height: element.scrollHeight }, bounds, gap)
    setPlace((now) => (now && ['side', 'x', 'y', 'width', 'height'].every((key) => now[key] === next[key]) ? now : next))
  }, [tick, width, gap, box])

  if (!place) return { side: undefined, style: { position: 'fixed', left: 0, top: 0, width, visibility: 'hidden' } }
  return { side: place.side, style: { position: 'fixed', left: place.x, top: place.y, width: place.width, maxHeight: place.height } }
}

// Tab stays inside `container`.
function trapTab(event, container) {
  const items = [...container.querySelectorAll(FOCUSABLE)]
  if (items.length === 0) {
    event.preventDefault()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

// The popover a click on an item cell opens: `children` (the full ItemTooltip and the actions) in a
// panel Frame beside the cell, or a bottom sheet on a phone. Focus moves in; Escape closes it and
// gives focus back to the cell; a click outside (the cell aside) closes it; Tab stays inside.
// label: the item's name. anchor: () => the cell element. onClose: closes it (the owner drops it).
export function ItemPopover({ label, anchor, onClose, closeLabel, children }) {
  const wide = useWide()
  const box = useRef(null)
  const { side, style } = usePlacement(anchor, box, POPOVER_WIDTH, 8)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const anchorRef = useRef(anchor)
  anchorRef.current = anchor

  // Focus moves in once the box is placed: a hidden box (still being measured) can't take it.
  const ready = !wide || Boolean(side)
  const focused = useRef(false)
  useEffect(() => {
    if (!ready || focused.current) return
    focused.current = true
    box.current?.focus({ preventScroll: true })
  }, [ready])

  // Escape closes it from anywhere: the popover's own keys stop there, so this one only hears an
  // Escape pressed while focus is out of it (on the cell, say).
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape' || box.current?.contains(event.target)) return
      anchorRef.current()?.focus()
      closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // A press anywhere else closes it; the cell itself toggles it on its own click.
  useEffect(() => {
    if (!wide) return undefined
    const onDown = (event) => {
      const target = event.target
      if (box.current?.contains(target) || anchorRef.current()?.contains(target)) return
      closeRef.current()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [wide])

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      // The phone drawer around the panel closes on Escape too: this one is the popover's.
      event.stopPropagation()
      event.preventDefault()
      anchor()?.focus()
      onClose()
      return
    }
    if (event.key === 'Tab') trapTab(event, box.current)
  }

  if (!wide) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <button type="button" tabIndex={-1} aria-label={closeLabel} onClick={onClose} className="absolute inset-0 cursor-default bg-[#05040c]/70" />
        <Frame
          ref={box}
          tone="panel"
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          data-sheet="true"
          className="relative flex max-h-[80dvh] w-full max-w-[560px] flex-col p-1 font-mono text-xs text-[#e9e4ff] shadow-[0_-4px_0_rgba(5,4,12,.45)] focus-visible:outline-none"
        >
          <header className="flex items-center justify-between gap-2 border-b-2 border-[#0a0818] px-1.5 pb-1.5 pt-1 shadow-[0_2px_0_#3e3170]">
            <i aria-hidden="true" className="ml-1 block h-1 w-10 bg-[#574a96]" />
            <ActionButton onClick={onClose}>{closeLabel}</ActionButton>
          </header>
          <div className="gw-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-1.5">{children}</div>
        </Frame>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <Frame
      ref={box}
      tone="panel"
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-side={side}
      style={style}
      className="z-50 flex flex-col p-1 font-mono text-xs text-[#e9e4ff] shadow-[4px_4px_0_rgba(5,4,12,.55)] focus-visible:outline-none"
    >
      <div className="gw-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-0.5">{children}</div>
    </Frame>,
    document.body,
  )
}

// The compact card a hover or keyboard focus shows beside a cell: name in the rarity color, rarity
// and item level, the item's stats, and arrows against what is worn in that slot.
// equipped: the item worn in that slot (none: no compare). worn: true when this item is the worn one.
// hint: a last muted line (what a click does).
export function ItemTip({ id, item, anchor, equipped, worn = false, hint }) {
  const text = useItemText()
  const { t } = text
  const box = useRef(null)
  const { side, style } = usePlacement(anchor, box, TIP_WIDTH, 6)
  const isGem = item.kind === 'gem'
  const trim = isGem ? GEM_TRIM : (RARITY_TRIM[item.rarity] ?? RARITY_TRIM.common)
  const color = isGem ? GEM_TEXT : (RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common).text
  const stats = Object.entries(isGem ? (GEMS[item.gem] ?? {}) : itemStats(item)).filter(([, value]) => value)
  const diffs = !isGem && !worn && equipped && equipped.id !== item.id ? statDiff(item, equipped) : null

  return createPortal(
    <Frame
      ref={box}
      id={id}
      role="tooltip"
      data-side={side}
      tone="raised"
      style={{ ...style, '--f-hi': trim, '--f-lo': `color-mix(in srgb, ${trim} 40%, #0a0818)` }}
      className="pointer-events-none z-50 flex flex-col gap-1 px-2.5 py-2 font-mono text-[11px] leading-[1.35] text-[#e9e4ff] shadow-[3px_3px_0_rgba(5,4,12,.55)]"
    >
      <b className="font-pixel text-[11px] font-normal leading-tight" style={{ color }}>
        {text.name(item)}
      </b>
      <small className="text-[10px] text-[#a89fd0]">{isGem ? t('game.item.gem') : text.line(item)}</small>
      {worn && (
        <span>
          <Chip tone="ok">{t('game.item.equipped')}</Chip>
        </span>
      )}
      {stats.length > 0 && (
        <ul className="m-0 list-none p-0 text-white">
          {stats.map(([stat, value]) => (
            <li key={stat}>{text.statLine(stat, value)}</li>
          ))}
        </ul>
      )}
      {diffs && (
        <div className="border-t-2 border-[#0a0818] pt-1 shadow-[inset_0_2px_0_#3e3170]">
          <span className="text-[#a89fd0]">{t('game.item.compare')}</span>
          {diffs.length === 0 ? (
            <span> {t('game.item.same')}</span>
          ) : (
            <ul className="m-0 list-none p-0">
              {diffs.map(([stat, value]) => (
                <li key={stat} data-trend={value > 0 ? 'up' : 'down'} className={value > 0 ? 'text-[#6fe39a]' : 'text-[#ff9aa6]'}>
                  <span aria-hidden="true">{value > 0 ? '▲ ' : '▼ '}</span>
                  {text.statLine(stat, value)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!isGem && !worn && !equipped && <small className="text-[10px] text-[#6fe39a]">{t('gamePopover.freeSlot')}</small>}
      {hint && <small className="text-[10px] text-[#9a93b8]">{hint}</small>}
    </Frame>,
    document.body,
  )
}

// Which cell's tooltip shows: one at a time. peek(id, on) from the cell's hover and focus.
export function useItemPeek() {
  const tipId = useId()
  const [id, setId] = useState(null)
  const peek = useCallback((itemId, on) => setId((now) => (on ? itemId : now === itemId ? null : now)), [])
  return { id, tipId, peek }
}

// The cell with that item inside `scope` (a ref), for a popover or tooltip to stand beside.
export const cellIn = (scope, itemId) => () => (itemId ? (scope.current?.querySelector(`[data-item-id="${itemId}"]`) ?? null) : null)
