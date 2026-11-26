import { getGame, getWorld } from '../../lib/api.js'

// The world page's first data, started early (fase 4): the signed-in shell asks for where the hero
// stands (GET /api/world) and the game View (GET /api/game, read only) as soon as it mounts, so /mundo
// opens on answers already on their way. The world page takes them once; after that it always loads
// its own, so a position saved while walking is never read back stale. Nothing here throws: a failed
// prefetch is a rejected promise the page replaces with a fresh call.

export const PREFETCH_MAX_AGE_MS = 120_000

let entry = null // { key, at, world, game }
let opened = false

const quiet = (promise) => {
  promise.catch(() => {})
  return promise
}

// key: the signed-in user's id (none: no prefetch). getToken: resolves to the session token.
export function prefetchWorld(key, getToken, { now = Date.now() } = {}) {
  if (!key || opened) return
  if (entry && entry.key === key && now - entry.at < PREFETCH_MAX_AGE_MS) return
  const token = quiet(Promise.resolve().then(() => getToken()))
  entry = {
    key,
    at: now,
    world: quiet(token.then((value) => getWorld(value))),
    game: quiet(token.then((value) => getGame(value))),
  }
}

// The prefetched { world, game } promises for this user while fresh, once; otherwise null.
export function takeWorldPrefetch(key, now = Date.now()) {
  opened = true
  const taken = entry
  entry = null
  if (!taken || !key || taken.key !== key || now - taken.at >= PREFETCH_MAX_AGE_MS) return null
  return { world: taken.world, game: taken.game }
}

// Tests and sign out: forget the prefetch and that the world page opened.
export function resetWorldPrefetch() {
  entry = null
  opened = false
}
