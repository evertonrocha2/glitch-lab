import { isLook } from '../../../../shared/game/look.js'
import { drawableGear } from '../hero/gear.js'

// The last hero this browser saw (look + drawable gear), so the loading screen can show your own
// hero instead of a stranger. Kept in memory and in localStorage (a per-viewer convenience: storage
// can be missing or blocked, then only this tab remembers).
const KEY = 'gd:last-hero'
let known = null

// Remembers the hero the page just loaded. Anything that is not a valid look is ignored.
export function rememberHero(look, gear) {
  if (!isLook(look)) return
  known = { look: { ...look }, gear: drawableGear(gear) }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(known))
  } catch {
    // Remembered for this tab only.
  }
}

// The remembered hero, or null.
export function knownHero() {
  if (known) return known
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null')
    if (saved && isLook(saved.look)) known = { look: saved.look, gear: drawableGear(saved.gear) }
  } catch {
    // Nothing saved, or storage is blocked.
  }
  return known
}

// For tests.
export function forgetHero() {
  known = null
}
