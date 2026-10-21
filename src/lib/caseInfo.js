// "TypeError: message" style first lines (also dotted Java/C# names). Anything else is a plain "Error".
const TYPED_ERROR = /^([A-Za-z_$][\w$.]*)\s*:\s*(.*)$/

export function splitError(text) {
  const firstLine = text.split('\n')[0].trim()
  const match = TYPED_ERROR.exec(firstLine)
  return match ? { type: match[1], message: match[2] } : { type: 'Error', message: firstLine }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function timeAgo(iso, now = new Date()) {
  const elapsed = now - new Date(iso)
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`
  return `${Math.floor(elapsed / DAY)}d ago`
}

// The bug type that shows up most among cases you haven't solved yet.
export function weakSpot(cases) {
  const counts = new Map()
  for (const item of cases) {
    if (item.status !== 'solved') counts.set(item.concept, (counts.get(item.concept) ?? 0) + 1)
  }
  let best = null
  for (const [concept, count] of counts) {
    if (!best || count > best.count) best = { concept, count }
  }
  return best
}
