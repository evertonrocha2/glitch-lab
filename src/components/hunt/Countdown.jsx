import { useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

const LOW_MS = 5_000

function prefersReducedMotion() {
  try {
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  } catch {
    return false
  }
}

// The round's clock: a bar that empties toward `deadline` (a local Date.now() time) and the seconds
// left. With reduced motion the bar steps once a second instead of gliding. Calls onExpire once,
// when it reaches zero while running.
export default function Countdown({ deadline, totalMs, running = true, onExpire }) {
  const t = useT()
  const [now, setNow] = useState(() => Date.now())
  const [reduced] = useState(prefersReducedMotion)
  const fired = useRef(null)
  const expire = useRef(onExpire)
  expire.current = onExpire

  // A new deadline (the next round) restarts the ticking right away.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deadline restarts the interval on purpose
  useEffect(() => {
    if (!running) return undefined
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), reduced ? 1000 : 100)
    return () => clearInterval(timer)
  }, [running, reduced, deadline])

  const left = Math.max(0, deadline - now)
  useEffect(() => {
    if (!running || left > 0 || fired.current === deadline) return
    fired.current = deadline
    expire.current?.()
  }, [running, left, deadline])

  const seconds = Math.ceil(left / 1000)
  // Reduced motion: whole seconds only, so the bar moves in steps.
  const share = (reduced ? seconds * 1000 : left) / totalMs
  const low = left <= LOW_MS
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden="true" className="relative h-4 min-w-0 flex-1 border-2 border-ink bg-white">
        <div
          className={`absolute inset-y-0 left-0 motion-safe:transition-[width] motion-safe:duration-100 motion-safe:ease-linear ${low ? 'bg-primary' : 'bg-secondary'}`}
          style={{ width: `${Math.min(100, share * 100)}%` }}
        />
      </div>
      <p role="timer" aria-label={t('hunt.timeLeft')} className={`w-10 shrink-0 text-right font-pixel text-base font-bold leading-none tabular-nums ${low ? 'text-primary' : 'text-ink'}`}>
        {t('hunt.seconds', { seconds })}
      </p>
    </div>
  )
}
