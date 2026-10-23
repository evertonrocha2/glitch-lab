import { useI18n } from './I18nProvider.jsx'

// Dates, relative times and numbers in the reader's language, built on Intl.
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// "há 2 horas" -> "Há 2 horas", for text that starts a line or stands alone. Inside a sentence
// ("Publicada há 2 horas") use the plain value.
export const capitalize = (text, locale) => (text ? text.charAt(0).toLocaleUpperCase(locale) + text.slice(1) : text)

// Lowercase ("2 hours ago", "há 2 horas", "ontem") so it reads right inside a sentence.
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

// { timeAgo, since, date, day, number, capitalize } bound to the current language. `since` is timeAgo with a
// capital first letter ("Há 2 horas"), for a time shown on its own under a card, comment or note.
export function useFormat() {
  const { locale } = useI18n()
  return {
    timeAgo: (iso, now) => timeAgoIn(locale, iso, now),
    since: (iso, now) => capitalize(timeAgoIn(locale, iso, now), locale),
    date: (iso, options) => dateIn(locale, iso, options),
    day: (value, options) => dayIn(locale, value, options),
    number: (value) => numberIn(locale, value),
    capitalize: (text) => capitalize(text, locale),
  }
}
