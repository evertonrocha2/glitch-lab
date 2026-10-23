import { useEffect, useState } from 'react'
import { eventStatus, timeLeft } from '../../../shared/events.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../../lib/i18n/format.js'
import EventIcon from './EventIcon.jsx'

const pad = (value) => String(value).padStart(2, '0')
// "Oct 22, 14:00": dates read in the visitor's own time zone and language.
export const WHEN = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }

// The status as the clock sees it now, ticking every `every` ms so it moves on by itself.
export function useNow(every = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(timer)
  }, [every])
  return now
}

const STATUS_TONES = {
  upcoming: 'bg-secondary-soft text-secondary',
  live: 'bg-primary text-white',
  voting: 'bg-secondary text-white',
  ended: 'bg-mist text-muted',
}

export function StatusChip({ status }) {
  const t = useT()
  return (
    <span className={`inline-flex items-center gap-1.5 border-2 border-ink px-1.5 py-0.5 font-label text-[10px] ${STATUS_TONES[status]}`}>
      {status === 'live' && <span aria-hidden="true" className="size-1.5 bg-white motion-safe:animate-blink" />}
      {t(`events.status.${status}`)}
    </span>
  )
}

export function KindChip({ kind }) {
  const t = useT()
  return <span className="inline-flex border-2 border-transparent bg-primary-soft px-1.5 py-0.5 font-label text-[10px] text-primary">{t(`events.kind.${kind}`)}</span>
}

// "Ends in 2d 03h 04m 05s", or when it ended. compact drops the seconds (for list cards).
export function Countdown({ event, now, compact = false, className = '' }) {
  const t = useT()
  const { date } = useFormat()
  const status = eventStatus(event, now)
  if (status === 'ended') {
    // Its own small size: a big clock's className only sets the numbers' size.
    return (
      <span className={`flex ${className}`}>
        <span className="font-label text-xs text-muted">{t('events.countdown.ended', { date: date(event.closesAt, WHEN) })}</span>
      </span>
    )
  }
  const target = { upcoming: event.startsAt, live: event.endsAt, voting: event.closesAt }[status]
  const { days, hours, minutes, seconds } = timeLeft(Date.parse(target) - now)
  const parts = [days > 0 && `${days}d`, `${pad(hours)}h`, `${pad(minutes)}m`, !compact && `${pad(seconds)}s`].filter(Boolean)
  return (
    <span className={`flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className="font-label text-[10px] text-muted">{t(`events.countdown.${status}`)}</span>
      <span aria-hidden="true" className="font-pixel font-bold tabular-nums text-ink">
        {parts.join(' ')}
      </span>
      <span className="sr-only">{t('events.countdown.sr', { days, hours, minutes })}</span>
    </span>
  )
}

export function DateRange({ event, className = '' }) {
  const t = useT()
  const { date } = useFormat()
  return (
    <span className={`flex items-center gap-1.5 text-xs text-muted ${className}`}>
      <EventIcon name="clock" className="size-3 text-secondary" />
      {t('events.dates', { start: date(event.startsAt, WHEN), end: date(event.endsAt, WHEN) })}
    </span>
  )
}
