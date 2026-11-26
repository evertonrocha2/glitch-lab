// Where a popover or a tooltip goes next to an item cell: pure math on plain rects
// ({ left, top, right, bottom }, viewport pixels), so it is tested without a browser.

const clamp = (value, low, high) => Math.max(low, Math.min(value, high))

// The room each side leaves for a box, from the cell's edge (plus the gap) to the bounds.
function roomOf(anchor, bounds, gap) {
  return {
    right: bounds.right - anchor.right - gap,
    left: anchor.left - gap - bounds.left,
    bottom: bounds.bottom - anchor.bottom - gap,
    top: anchor.top - gap - bounds.top,
  }
}

const SIDEWAYS = new Set(['left', 'right'])

// Places a box of `size` ({ width, height }) beside `anchor`, inside `bounds`, `gap` px away.
// Tries the sides in `order` and takes the first where the box fits whole on that side; then slides
// it along the cell (top aligned for left/right, left aligned for top/bottom) to stay inside the
// bounds. When no side fits, it takes the roomiest one and shrinks the box to it. The box never
// covers the cell: it always starts past the cell's edge on its side.
// Answers { side, x, y, width, height }: the box's top-left corner and the size it may take.
export function placeBeside(anchor, size, bounds, gap = 8, order = ['right', 'left', 'bottom', 'top']) {
  const room = roomOf(anchor, bounds, gap)
  const need = (side) => (SIDEWAYS.has(side) ? size.width : size.height)
  const side = order.find((each) => room[each] >= need(each)) ?? order.reduce((best, each) => (room[each] / need(each) > room[best] / need(best) ? each : best))

  if (SIDEWAYS.has(side)) {
    const width = Math.max(0, Math.min(size.width, room[side]))
    const height = Math.min(size.height, bounds.bottom - bounds.top)
    const x = side === 'right' ? anchor.right + gap : anchor.left - gap - width
    const y = clamp(anchor.top, bounds.top, bounds.bottom - height)
    return { side, x, y, width, height }
  }
  const height = Math.max(0, Math.min(size.height, room[side]))
  const width = Math.min(size.width, bounds.right - bounds.left)
  const y = side === 'bottom' ? anchor.bottom + gap : anchor.top - gap - height
  const x = clamp(anchor.left, bounds.left, bounds.right - width)
  return { side, x, y, width, height }
}

// The box a popover must stay in: `frame` (a rect, or null for none) crossed with the viewport
// ({ width, height }), less a margin on every side.
export function boxOf(frame, viewport, margin = 8) {
  const left = Math.max(frame?.left ?? 0, 0)
  const top = Math.max(frame?.top ?? 0, 0)
  const right = Math.min(frame?.right ?? viewport.width, viewport.width)
  const bottom = Math.min(frame?.bottom ?? viewport.height, viewport.height)
  return { left: left + margin, top: top + margin, right: right - margin, bottom: bottom - margin }
}
