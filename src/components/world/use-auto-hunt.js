import { useEffect, useRef } from 'react'

// Standing in a hunt zone hunts there (fase 3): once the hero has stayed SETTLE_MS in a zone, the
// server hunt starts there (or moves there, paying the last one); once it has stayed that long on safe
// ground (the town), the hunt stops and pays. Walking through a zone on the way somewhere else changes
// nothing. The server stays the judge: this only sends the same startHunt / stopHunt the panel did.
export const SETTLE_MS = 800

const same = (a, b) => Boolean(a && b) && a.world === b.world && a.zone === b.zone

// What to do for a hero standing where `wanted` says ({ world, zone, difficulty }, or null on safe
// ground) while `hunt` runs (the View's hero.hunt, or null): 'start', 'stop' or null. paused: the
// { world, zone } the player stopped the hunt in by hand; it stays stopped until the hero leaves it.
export function huntMove({ hunt, wanted, paused }) {
  if (!wanted) return hunt ? 'stop' : null
  if (same(paused, wanted)) return null
  return same(hunt, wanted) && hunt.difficulty === wanted.difficulty ? null : 'start'
}

// Runs huntMove after the settle-in. view: the game View (nothing happens before it loads). blocked: a
// boss fight is playing. start(target) / stop() call the server.
export function useAutoHunt({ view, wanted, paused, blocked, start, stop }) {
  // Read when the timer fires; the key below says when to set a new one.
  const latest = useRef(null)
  latest.current = { start, stop, wanted }
  const hunt = view?.hero?.hunt ?? null
  const move = view && !blocked ? huntMove({ hunt, wanted, paused }) : null
  // Where the hero stands and what to do there: a new key restarts the settle-in.
  const key = move && `${move}:${wanted?.world}:${wanted?.zone}:${wanted?.difficulty}`
  useEffect(() => {
    if (!key) return undefined
    const timer = setTimeout(() => {
      const now = latest.current
      if (key.startsWith('start')) now.start(now.wanted)
      else now.stop()
    }, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [key])
}
