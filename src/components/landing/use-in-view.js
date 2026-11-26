import { useEffect, useState } from 'react'

// True while the element is on screen and the tab is shown, so landing loops (the hero card's
// attacks) stop when nobody can see them. Without IntersectionObserver it counts as on screen.
export function useInView(ref) {
  const [onScreen, setOnScreen] = useState(false)
  const [shown, setShown] = useState(() => typeof document === 'undefined' || !document.hidden)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const onVisibility = () => setShown(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    if (typeof IntersectionObserver !== 'function') {
      setOnScreen(true)
      return () => document.removeEventListener('visibilitychange', onVisibility)
    }
    const watcher = new IntersectionObserver((entries) => setOnScreen(entries[entries.length - 1].isIntersecting))
    watcher.observe(el)
    return () => {
      watcher.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [ref])

  return onScreen && shown
}
