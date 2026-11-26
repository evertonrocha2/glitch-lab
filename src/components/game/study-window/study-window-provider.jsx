import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import StudyWindow from './study-window.jsx'

const StudyWindowContext = createContext(null)
// Where the window opens when a caller gives no page.
const DEFAULT_HREF = '/daily'

// The game's study window, for everything under it: useStudyWindow() opens a study page in a window
// over the game instead of leaving it (a bottom sheet on phones). There is one window per page: a
// provider inside another one just uses the outer one, so GameView can carry its own and a page
// (the Lab, the hunt) can mount one above both and keep the window across them.
export function StudyWindowProvider({ children }) {
  const outer = useContext(StudyWindowContext)
  if (outer) return children
  return <Root>{children}</Root>
}

// { open(href), close(), isOpen }, or null outside a provider (then a study link stays a plain link).
//   open(href): shows that study page (a path like '/daily'); with the window open it switches page
//   and brings it back if minimized. isOpen: true while open, minimized included.
export function useStudyWindow() {
  return useContext(StudyWindowContext)
}

function Root({ children }) {
  // href: the page shown (null: closed). minimized: shrunk to a pill, page kept.
  const [state, setState] = useState({ href: null, minimized: false })
  // What had focus when the window opened; it gets focus back on close.
  const opener = useRef(null)

  const shown = useRef(null)
  shown.current = state.href

  const open = useCallback((href = DEFAULT_HREF) => {
    if (shown.current === null) opener.current = document.activeElement
    setState({ href: href || DEFAULT_HREF, minimized: false })
    // A fullscreen game would hide the window: it comes back to the page first.
    if (document.fullscreenElement) document.exitFullscreen?.().catch?.(() => {})
  }, [])
  const close = useCallback(() => setState({ href: null, minimized: false }), [])
  const navigate = useCallback((href) => setState((current) => ({ ...current, href })), [])
  const minimize = useCallback((minimized) => setState((current) => ({ ...current, minimized })), [])

  const isOpen = state.href !== null
  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen])
  return (
    <StudyWindowContext.Provider value={value}>
      {children}
      {isOpen && (
        <StudyWindow
          href={state.href}
          minimized={state.minimized}
          opener={opener}
          onNavigate={navigate}
          onMinimize={() => minimize(true)}
          onRestore={() => minimize(false)}
          onClose={close}
        />
      )}
    </StudyWindowContext.Provider>
  )
}
