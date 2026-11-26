import { useCallback, useEffect, useState } from 'react'
import { ZOOM_KEY, ZOOMS } from './hub-view.js'

// The zoom level, shared with the hunt through the same storage key. Storage can be missing or
// blocked: then it is just far. change(step): -1 moves the camera out, +1 in, stopping at the ends.
export function useHubZoom() {
  const [zoom, setZoom] = useState(() => {
    try {
      const saved = window.localStorage.getItem(ZOOM_KEY)
      return ZOOMS.includes(saved) ? saved : 'far'
    } catch {
      return 'far'
    }
  })
  const change = useCallback((step) => {
    setZoom((current) => {
      const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(current) + step))]
      try {
        window.localStorage.setItem(ZOOM_KEY, next)
      } catch {
        // Not remembered, still applied.
      }
      return next
    })
  }, [])
  return [zoom, change]
}

// Whether a media query matches, following it live. Without matchMedia (tests, old browsers): true.
export function useMediaQuery(query) {
  const read = () => {
    try {
      return window.matchMedia ? window.matchMedia(query).matches : true
    } catch {
      return true
    }
  }
  const [matches, setMatches] = useState(read)
  useEffect(() => {
    let list = null
    try {
      list = window.matchMedia?.(query) ?? null
    } catch {
      list = null
    }
    if (!list?.addEventListener) return undefined
    const onChange = () => setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// The room the stage has: its box's width, and the height the screen leaves it (the window less
// 24rem for the header, the title and the status line, never under 18rem). null until measured
// (no ResizeObserver: tests, old browsers), so callers keep their own sizes.
export function useStageBox(ref) {
  const [box, setBox] = useState(null)
  useEffect(() => {
    const node = ref.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const rem = () => Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    let width = 0
    const update = () => {
      const height = Math.max(18 * rem(), window.innerHeight - 24 * rem())
      setBox((current) => (current?.width === width && current?.height === height ? current : { width, height }))
    }
    const observer = new ResizeObserver(([entry]) => {
      width = Math.floor(entry.contentRect.width)
      update()
    })
    observer.observe(node)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [ref])
  return box
}
