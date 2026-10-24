import { lazy } from 'react'
import { loadPage } from '../lib/stale-build.js'

// Every page but the landing and login (the first screens people see) is its own chunk, so the
// first load parses only what it shows. Tests get the same pages eagerly (see eager-pages.js).
const loaders = import.meta.glob(['../pages/*/*-page.jsx', '!../pages/landing-page/*', '!../pages/login-page/*'])

// '../pages/board-page/board-page.jsx' -> 'BoardPage'
const nameOf = (path) =>
  path
    .split('/')
    .at(-1)
    .replace('.jsx', '')
    .replace(/(^|-)(\w)/g, (_, __, letter) => letter.toUpperCase())

export const pages = Object.fromEntries(Object.entries(loaders).map(([path, load]) => [nameOf(path), lazy(loadPage(load))]))

const whenIdle = (callback) => (globalThis.requestIdleCallback ? requestIdleCallback(callback, { timeout: 4000 }) : setTimeout(callback, 200))

// Fetches the other pages one at a time while the browser is idle, so moving between pages
// later never waits on the network. Skipped when the visitor asked to save data.
let preloading = false
export function preloadPages() {
  if (preloading || globalThis.navigator?.connection?.saveData) return
  preloading = true
  const queue = Object.values(loaders)
  const next = () => {
    const load = queue.shift()
    if (load) load().then(() => whenIdle(next), () => whenIdle(next))
  }
  whenIdle(next)
}
