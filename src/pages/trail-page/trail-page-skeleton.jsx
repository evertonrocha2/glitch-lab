import TrailMapSkeleton from '../../components/trail/trail-map/trail-map-skeleton.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Line, Lines } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// The trail while it loads: the header card (title, summary, mission bar, counters) and the path.
export default function TrailPageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('notes.trail.loading')}>
      <PixelCard className="mt-8 p-6 sm:p-8">
        <Line className="font-label text-xs" width="w-32" />
        <Line className="mt-2 font-pixel text-3xl font-bold sm:text-4xl" width="w-3/5" />
        <div className="mt-2 max-w-2xl">
          <Lines count={2} />
        </div>
        <div className="mt-5 flex gap-0.75 border-2 border-ink bg-white p-0.75">
          <Bone className="h-4 flex-1" />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Bone className="h-7 w-28" />
            <Bone className="h-7 w-24" />
          </div>
          <Bone className="h-10 w-36" />
        </div>
      </PixelCard>
      <TrailMapSkeleton />
    </Skeleton>
  )
}
