import { Link } from 'react-router'
import { eventStatus } from '../../../shared/events.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import AuthorChip from '../community/AuthorChip.jsx'
import { Countdown, DateRange, KindChip, StatusChip } from './EventBits.jsx'

// One event in the list: kind and status, title, summary, organizer, dates, countdown and entries.
export default function EventCard({ event, now }) {
  const t = useT()
  const status = eventStatus(event, now)
  return (
    <article className="relative flex w-full min-w-0 flex-col overflow-hidden border-2 border-ink bg-white p-4 shadow-pixel-muted transition-[translate,box-shadow] duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-pixel sm:p-5">
      {status === 'live' && <div aria-hidden="true" className="dither-primary absolute top-0 right-0 h-16 w-1/3 opacity-10" />}
      <div className="relative flex flex-wrap items-center gap-2">
        <KindChip kind={event.kind} />
        <StatusChip status={status} />
        {event.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="font-mono text-xs text-primary">
            #{tag}
          </span>
        ))}
      </div>
      <h2 className="relative mt-3 break-words font-pixel text-xl font-bold leading-tight text-ink sm:text-2xl">
        <Link to={`/events/${event.id}`} className="hover:text-primary hover:underline">
          {event.title}
        </Link>
      </h2>
      <p className="mt-2 line-clamp-2 break-words text-sm text-ink/80">{event.summary}</p>
      <DateRange event={event} className="mt-3" />
      <span aria-hidden="true" className="min-h-4 flex-1" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-line pt-3">
        <AuthorChip author={event.organizer} meta={t('events.card.entries', { count: event.entryCount })} size="size-7" />
        <Countdown event={event} now={now} compact className="text-sm" />
      </div>
    </article>
  )
}
