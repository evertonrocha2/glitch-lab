const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 3_600_000

export const serverDay = (now = new Date()) => now.toISOString().slice(0, 10)

// The browser sends its local date so "today" matches the student's clock. Anything more than
// a day away from the server's date (in either direction) is not a real time zone: null.
export function clientDay(value, now = new Date()) {
  if (typeof value !== 'string' || !DAY_FORMAT.test(value)) return null
  const time = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(time)) return null
  const distance = Math.abs(time - Date.parse(`${serverDay(now)}T00:00:00Z`))
  return distance <= DAY_MS ? value : null
}
