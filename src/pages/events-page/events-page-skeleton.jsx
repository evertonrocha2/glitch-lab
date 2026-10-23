import EventCardSkeleton from '../../components/events/event-card/event-card-skeleton.jsx'
import Skeleton from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// The events while they load: a page of event cards in the list's own grid.
export default function EventsPageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('events.list.loading')} className="grid gap-5 md:grid-cols-2">
      {[1, 2, 3, 4].map((slot) => (
        <div key={slot} className="flex">
          <EventCardSkeleton />
        </div>
      ))}
    </Skeleton>
  )
}
