import Skeleton, { Bone, Line } from '../../ui/skeleton/skeleton.jsx'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// Today's review while it loads, inside its card: the "due" count, the concept chips and the
// start button, laid out like the real row.
export default function ReviewTodaySkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('review.loading')} className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <Line className="font-pixel text-2xl font-bold" width="w-44" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Bone className="h-7 w-24" />
          <Bone className="h-7 w-20" />
          <Bone className="h-7 w-28" />
        </div>
      </div>
      <Bone className="h-11 w-32 shrink-0" />
    </Skeleton>
  )
}
