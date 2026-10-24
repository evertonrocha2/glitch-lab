// After a deploy the old build's files are gone, so a tab opened before it fails to load a page it
// hasn't loaded yet. One reload picks up the new build; the stamp in sessionStorage keeps a
// genuinely broken file from reloading forever.
const KEY = 'gd:stale-reload'
const WINDOW_MS = 30_000

export function isChunkLoadError(err) {
  const text = String(err?.message ?? err ?? '')
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS/i.test(text)
}

// Reloads and returns true, unless it already did within the window (then false: let it fail).
export function reloadForNewBuild(now = Date.now(), storage = globalThis.sessionStorage, location = globalThis.location) {
  let last = 0
  try {
    last = Number(storage?.getItem(KEY)) || 0
  } catch {
    // Storage blocked: reload anyway, the browser's own cache keeps it from looping.
  }
  if (last && now - last < WINDOW_MS) return false
  try {
    storage?.setItem(KEY, String(now))
  } catch {
    // Same as above.
  }
  location?.reload()
  return true
}

// For React.lazy: a page that fails to load because the build moved on reloads the app instead
// of breaking it. Any other error is thrown as usual.
export function loadPage(load) {
  return () =>
    load().catch((err) => {
      if (isChunkLoadError(err) && reloadForNewBuild()) return new Promise(() => {})
      throw err
    })
}

// Vite's own signal for a failed preload of a split chunk.
export function watchForNewBuild(target = globalThis.window) {
  target?.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewBuild()) event.preventDefault()
  })
}
