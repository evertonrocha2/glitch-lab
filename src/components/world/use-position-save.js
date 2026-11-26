import { useCallback, useEffect, useRef } from 'react'

// A walk is saved at most this often; changing regions and opening a terminal save right away.
export const SAVE_DELAY_MS = 5000

// Keeps where the hero stands on the server (PUT /api/world/position) while it walks.
// where(): the place to save now, { world, x, y }. onSave(position, { keepalive }) sends it; its
// failures are ignored (the hero may just start a few tiles back next time).
// Saves go out one after another, so an older one can never land after a newer one. A save still
// waiting when the game goes away (or the tab closes: pagehide is the last word a page gets) goes out
// at once with keepalive. Answers { saveSoon, saveNow }; saveNow resolves when its save is done.
export function usePositionSave(where, onSave) {
  const whereRef = useRef(where)
  const saveRef = useRef(onSave)
  whereRef.current = where
  saveRef.current = onSave
  const timer = useRef(null)
  const saving = useRef(Promise.resolve())
  const inFlight = useRef(0)

  // keepalive saves are the page going away: they go out right now instead of waiting their turn.
  const persist = useCallback((keepalive) => {
    const place = whereRef.current()
    if (!place || !saveRef.current) return Promise.resolve()
    const { world, x, y } = place
    const send = () => Promise.resolve(saveRef.current({ world, x, y }, { keepalive })).catch(() => {})
    if (keepalive) return send()
    const run = () => {
      inFlight.current++
      return send().finally(() => inFlight.current--)
    }
    // Nothing out: go now. Otherwise wait for the saves still out.
    saving.current = inFlight.current === 0 ? run() : saving.current.then(run)
    return saving.current
  }, [])

  const saveNow = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
    return persist(false)
  }, [persist])

  const saveSoon = useCallback(() => {
    if (timer.current) return
    timer.current = setTimeout(() => {
      timer.current = null
      persist(false)
    }, SAVE_DELAY_MS)
  }, [persist])

  useEffect(() => {
    const flush = () => {
      if (!timer.current) return
      clearTimeout(timer.current)
      timer.current = null
      persist(true)
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [persist])

  return { saveSoon, saveNow }
}
