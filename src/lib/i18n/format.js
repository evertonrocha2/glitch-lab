import { useI18n } from './I18nProvider.jsx'

// Dates, relative times and numbers in the reader's language, built on Intl.
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function timeAgoIn(locale, iso, now = new Date()) {
  const elapsed = now - new Date(iso)
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (elapsed < MINUTE) return format.format(0, 'second')
  if (elapsed < HOUR) return format.format(-Math.floor(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return format.format(-Math.floor(elapsed / HOUR), 'hour')
  return format.format(-Math.floor(elapsed / DAY), 'day')
}

export const dateIn = (locale, iso, options = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  new Date(iso).toLocaleDateString(locale, options)

// A YYYY-MM-DD day, read as that calendar day wherever the reader is.
export const dayIn = (locale, day, options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', ...options })

export const numberIn = (locale, value) => new Intl.NumberFormat(locale).format(value)

// { timeAgo, date, day, number } bound to the current language.
export function useFormat() {
  const { locale } = useI18n()
  return {
    timeAgo: (iso, now) => timeAgoIn(locale, iso, now),
    date: (iso, options) => dateIn(locale, iso, options),
    day: (value, options) => dayIn(locale, value, options),
    number: (value) => numberIn(locale, value),
  }
}
