import { useEffect, useState } from 'react'
import { ELIXIR_TYPES } from '../../../../shared/game/elixirs.js'

// The elixirs still running at now, in the alchemist's order: [{ type, left (ms), expiresAt }].
export function activeElixirs(elixirs, now) {
  return ELIXIR_TYPES.flatMap((type) => {
    const entry = elixirs?.[type]
    if (!Number.isFinite(entry?.expiresAt) || entry.expiresAt <= now) return []
    return [{ type, left: entry.expiresAt - now, expiresAt: entry.expiresAt }]
  })
}

// A countdown as the HUD and the alchemist show it: m:ss, or h:mm:ss past an hour. Rounds up, so the
// last second reads 0:01 and an elixir never shows 0:00 while it still works.
export function countdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

// The clock, ticking every `ms` while `on` (a countdown is showing); still otherwise.
export function useNow(on, ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(timer)
  }, [on, ms])
  return now
}
