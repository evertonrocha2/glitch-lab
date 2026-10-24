import { expect, it, vi } from 'vitest'
import { isChunkLoadError, loadPage, reloadForNewBuild, watchForNewBuild } from './stale-build.js'

const memory = () => {
  const data = new Map()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
}

it('knows a missing chunk from any other error', () => {
  expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/notes-page-abc.js'))).toBe(true)
  expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
  expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true)
  expect(isChunkLoadError(new TypeError('Failed to fetch'))).toBe(false)
  expect(isChunkLoadError(new Error('x is not defined'))).toBe(false)
})

it('reloads once, then lets a second failure in the same half minute through', () => {
  const storage = memory()
  const location = { reload: vi.fn() }
  expect(reloadForNewBuild(1_000, storage, location)).toBe(true)
  expect(reloadForNewBuild(5_000, storage, location)).toBe(false)
  expect(location.reload).toHaveBeenCalledTimes(1)
  expect(reloadForNewBuild(40_000, storage, location)).toBe(true)
  expect(location.reload).toHaveBeenCalledTimes(2)
})

it('still reloads when storage is blocked', () => {
  const storage = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
  }
  const location = { reload: vi.fn() }
  expect(reloadForNewBuild(1_000, storage, location)).toBe(true)
  expect(location.reload).toHaveBeenCalledTimes(1)
})

it('passes a page through, and rethrows errors that are not a missing chunk', async () => {
  await expect(loadPage(async () => ({ default: 'Page' }))()).resolves.toEqual({ default: 'Page' })
  await expect(loadPage(async () => Promise.reject(new Error('boom')))()).rejects.toThrow('boom')
})

it("answers Vite's preload error with a reload", () => {
  sessionStorage.clear()
  const reload = vi.fn()
  vi.stubGlobal('location', { ...window.location, reload })
  const target = new EventTarget()
  watchForNewBuild(target)
  const event = new Event('vite:preloadError', { cancelable: true })
  target.dispatchEvent(event)
  expect(reload).toHaveBeenCalledTimes(1)
  expect(event.defaultPrevented).toBe(true)
  vi.unstubAllGlobals()
})
