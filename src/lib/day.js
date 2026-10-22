const pad = (value) => String(value).padStart(2, '0')

// YYYY-MM-DD on the student's own clock, so "today" and streaks match their day, not UTC.
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// 0 -> "0m", 3900 -> "1h 05m".
export function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${pad(minutes % 60)}m`
}

// Timer face: "04:09" under an hour, "1:02:03" after.
export function formatClock(seconds) {
  const whole = Math.floor(seconds)
  const hours = Math.floor(whole / 3600)
  const rest = `${pad(Math.floor((whole % 3600) / 60))}:${pad(whole % 60)}`
  return hours > 0 ? `${hours}:${rest}` : rest
}
