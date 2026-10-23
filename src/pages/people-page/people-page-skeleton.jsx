import PersonCardSkeleton from '../../components/profile/person-card/person-card-skeleton.jsx'
import Skeleton, { Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// The first search while it runs: the "newest" line and a page of person cards in the same grid.
export default function PeoplePageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('landing.people.loading')}>
      <Line className="mb-4 font-label text-[10px]" width="w-40" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((slot) => (
          <PersonCardSkeleton key={slot} />
        ))}
      </div>
    </Skeleton>
  )
}
