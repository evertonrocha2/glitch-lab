import { SLOTS } from '../../../../shared/game/items.js'
import { LOOK_OPTIONS, normalizeLook } from '../../../../shared/game/look.js'
import { POSES, paintHero, paintHeroDead } from './draw-hero.js'
import { drawableGear } from './gear.js'

// Painting the hero walks a 56x46 grid a few times, so each look+gear+pose is painted once and
// kept. Least recently used sprites drop out past LIMIT, so a long session never grows the cache.
const LIMIT = 64
const cache = new Map()

const LOOK_FIELDS = Object.keys(LOOK_OPTIONS)

// The same key for anything that paints the same: normalized look, drawable gear only.
function keyOf(look, gear, pose) {
  const l = normalizeLook(look)
  const g = drawableGear(gear)
  const lookKey = LOOK_FIELDS.map((field) => l[field]).join('.')
  const gearKey = SLOTS.map((slot) => (g[slot] ? `${g[slot].b}:${g[slot].r}` : '')).join(',')
  return `${lookKey}|${gearKey}|${pose}`
}

// The hero sprite canvas (SPRITE.w x SPRITE.h). pose: a POSES key, or 'dead'. `t` is accepted for
// callers but the sprite does not change with time.
export function heroSprite(look, gear, rawPose = 'idle0', _t = 0) {
  const pose = rawPose === 'dead' || Object.hasOwn(POSES, rawPose) ? rawPose : 'idle0'
  const key = keyOf(look, gear, pose)
  const hit = cache.get(key)
  if (hit) {
    // Move to the back: most recently used.
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const sprite = pose === 'dead' ? paintHeroDead(look, gear) : paintHero(look, gear, pose)
  cache.set(key, sprite)
  if (cache.size > LIMIT) cache.delete(cache.keys().next().value)
  return sprite
}

// For tests.
export function clearHeroCache() {
  cache.clear()
}
