// Where the study window sits on a desktop and how big it is: { x, y, w, h } in CSS pixels, fixed to
// the viewport. Remembered per browser; storage can be missing or blocked, then it is the default.
export const STORE_KEY = 'gd:study-window'
export const MIN_SIZE = { w: 340, h: 300 }
// The window never touches the screen's edge, so its frame and title bar always show.
const MARGIN = 8
// The default's gap to the right edge.
const GAP = 24

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

// The rect pulled inside a vw x vh viewport: at least MIN_SIZE (unless the screen is smaller), at
// most the screen less the margins, and every edge on screen.
export function clampRect({ x, y, w, h }, vw, vh) {
  const maxW = Math.max(0, vw - 2 * MARGIN)
  const maxH = Math.max(0, vh - 2 * MARGIN)
  const width = Math.round(clamp(w, Math.min(MIN_SIZE.w, maxW), maxW))
  const height = Math.round(clamp(h, Math.min(MIN_SIZE.h, maxH), maxH))
  return {
    x: Math.round(clamp(x, MARGIN, vw - width - MARGIN)),
    y: Math.round(clamp(y, MARGIN, vh - height - MARGIN)),
    w: width,
    h: height,
  }
}

// At the right side, beside the game's panel, tall enough for a question and its answers.
export function defaultRect(vw, vh) {
  const w = Math.min(560, vw - 2 * GAP)
  const h = Math.min(Math.round(vh * 0.86), vh - 2 * GAP)
  return clampRect({ x: vw - w - GAP, y: Math.round((vh - h) / 2), w, h }, vw, vh)
}

export function loadRect(vw, vh) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE_KEY))
    if (saved && ['x', 'y', 'w', 'h'].every((key) => Number.isFinite(saved[key]))) return clampRect(saved, vw, vh)
  } catch {
    // Unreadable: the default.
  }
  return defaultRect(vw, vh)
}

export function saveRect(rect) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(rect))
  } catch {
    // Not remembered, still applied.
  }
}
