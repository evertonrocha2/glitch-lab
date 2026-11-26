import { useCallback, useEffect, useState } from 'react'

// Fullscreen for one element: { active, toggle, supported }. supported is false where the browser
// has no Fullscreen API (iPhone Safari), and the HUD then hides its button.
export function useFullscreen(ref) {
  const [active, setActive] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    setSupported(typeof ref.current?.requestFullscreen === 'function')
    const sync = () => setActive(Boolean(ref.current) && document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [ref])

  const toggle = useCallback(() => {
    const el = ref.current
    if (document.fullscreenElement) {
      document.exitFullscreen?.()?.catch?.(() => {})
    } else if (typeof el?.requestFullscreen === 'function') {
      el.requestFullscreen()?.catch?.(() => {})
    }
  }, [ref])

  return { active, toggle, supported }
}
