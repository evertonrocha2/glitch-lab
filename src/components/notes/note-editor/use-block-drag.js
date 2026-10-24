import { useEffect, useRef, useState } from 'react'

const BLOCK_DRAG = 'application/x-glitch-block'
// A finger held this long on a handle picks the block up; moving sooner scrolls the page as usual.
const HOLD_MS = 350
const SLOP = 8
// This close to the top or bottom of the view, a drag scrolls it.
const EDGE = 72

// The nearest box that scrolls, or null for the page itself.
function scroller(element) {
  for (let node = element?.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (/auto|scroll/.test(overflowY) && node.scrollHeight > node.clientHeight) return node
  }
  return null
}

// Dragging blocks by their handle. A mouse uses the browser's drag and drop; a finger holds the
// handle for a moment, since phones don't drag that way. While a block is dragged, drag is
// { id, spot, top }: spot is the gap it would land in (0 the top, the block count the end) and top
// is where to draw that gap's line inside the list. onMove(id, spot) is called on the drop.
// The list's rows are its children with a data-block attribute.
export default function useBlockDrag(onMove) {
  const list = useRef(null)
  const [drag, setDrag] = useState(null)
  const live = useRef(null)
  live.current = drag
  const moveRef = useRef(onMove)
  moveRef.current = onMove
  const pointerY = useRef(null)
  const touch = useRef(null)
  // A finger lifted after a drag must not also open the handle's menu.
  const swallowClick = useRef(false)

  function hover(clientY) {
    const rows = list.current ? [...list.current.children].filter((node) => node.dataset.block) : []
    if (!rows.length) return
    let spot = rows.findIndex((row) => {
      const box = row.getBoundingClientRect()
      return clientY < box.top + box.height / 2
    })
    if (spot === -1) spot = rows.length
    const last = rows.at(-1)
    // Halfway into the 8px gap between rows (space-y-2), the line being 4px tall.
    const top = spot < rows.length ? rows[spot].offsetTop - 6 : last.offsetTop + last.offsetHeight + 2
    setDrag((current) => (!current || (current.spot === spot && current.top === top) ? current : { ...current, spot, top }))
  }

  function drop() {
    const current = live.current
    setDrag(null)
    pointerY.current = null
    if (current && current.spot !== null) moveRef.current(current.id, current.spot)
  }

  const dragging = drag !== null
  // Near an edge the view scrolls, a little faster the closer the pointer is, and the gap follows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: hover only reads refs and sets state
  useEffect(() => {
    if (!dragging) return
    const area = scroller(list.current)
    let frame = 0
    const tick = () => {
      const y = pointerY.current
      if (y !== null) {
        const box = area ? area.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
        const into = y < box.top + EDGE ? y - (box.top + EDGE) : y > box.bottom - EDGE ? y - (box.bottom - EDGE) : 0
        if (into) {
          const by = Math.sign(into) * Math.ceil(Math.min(Math.abs(into), EDGE) / 4)
          if (area) area.scrollBy(0, by)
          else window.scrollBy(0, by)
          hover(y)
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    // Anywhere on the page counts, not just over the list: above it is the top, below it the end,
    // so a drop that misses by a little (or after the pointer crossed the header) still lands.
    const over = (event) => {
      if (!live.current || touch.current) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
      pointerY.current = event.clientY
      hover(event.clientY)
    }
    const dropped = (event) => {
      if (!live.current || touch.current) return
      event.preventDefault()
      drop()
    }
    document.addEventListener('dragover', over)
    document.addEventListener('drop', dropped)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('dragover', over)
      document.removeEventListener('drop', dropped)
    }
  }, [dragging])

  useEffect(() => () => touch.current?.stop(), [])

  // A finger on the handle: held still, it picks the block up; moved first, it was a scroll.
  function holdStart(event, id) {
    if (event.pointerType === 'mouse' || touch.current) return
    const from = { x: event.clientX, y: event.clientY }
    const state = { active: false }
    const timer = setTimeout(() => {
      state.active = true
      pointerY.current = from.y
      setDrag({ id, spot: null, top: 0 })
      navigator.vibrate?.(10)
    }, HOLD_MS)
    const move = (next) => {
      if (next.pointerId !== event.pointerId) return
      if (!state.active) {
        if (Math.hypot(next.clientX - from.x, next.clientY - from.y) > SLOP) stop()
        return
      }
      pointerY.current = next.clientY
      hover(next.clientY)
    }
    const up = (next) => {
      if (next.pointerId !== event.pointerId) return
      if (state.active) {
        swallowClick.current = true
        setTimeout(() => {
          swallowClick.current = false
        }, 400)
        drop()
      }
      stop()
    }
    const cancel = (next) => {
      if (next.pointerId !== event.pointerId) return
      if (state.active) setDrag(null)
      stop()
    }
    // Once the block is picked up, the finger moves it instead of scrolling the page.
    const still = (next) => {
      if (state.active) next.preventDefault()
    }
    function stop() {
      clearTimeout(timer)
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', cancel)
      document.removeEventListener('touchmove', still)
      touch.current = null
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', cancel)
    document.addEventListener('touchmove', still, { passive: false })
    touch.current = { stop }
  }

  const listProps = { ref: list }

  const handleProps = (id) => ({
    draggable: true,
    onDragStart: (event) => {
      // A finger is already holding it: that way of dragging wins.
      if (touch.current) {
        event.preventDefault()
        return
      }
      const data = event.dataTransfer
      data.effectAllowed = 'move'
      data.setData(BLOCK_DRAG, id)
      // The whole block follows the pointer, not just the handle.
      const row = event.currentTarget.closest('[data-block]')
      if (row && data.setDragImage) {
        const box = row.getBoundingClientRect()
        data.setDragImage(row, event.clientX - box.left, event.clientY - box.top)
      }
      setDrag({ id, spot: null, top: 0 })
    },
    onDragEnd: () => {
      setDrag(null)
      pointerY.current = null
    },
    onPointerDown: (event) => holdStart(event, id),
    onClickCapture: (event) => {
      if (swallowClick.current) event.preventDefault()
    },
    onContextMenu: (event) => {
      if (touch.current) event.preventDefault()
    },
  })

  return { drag, listProps, handleProps }
}
