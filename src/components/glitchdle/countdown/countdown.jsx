import { useEffect, useState } from 'react'
import { formatCountdown } from '../../../lib/daily.js'

// The time left until `resetAt`, ticking once a second. It owns the timer, so only this text
// re-renders every second, not the page around it.
export default function Countdown({ resetAt, className }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return <span className={className}>{formatCountdown(Date.parse(resetAt) - now)}</span>
}
