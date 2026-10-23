import ActivityGraphSkeleton from '../../components/progress/activity-graph/activity-graph-skeleton.jsx'
import SkillMapSkeleton from '../../components/review/skill-map/skill-map-skeleton.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// Your progress while it loads, block for block: the level card beside the counters, the
// activity graph, the skill map, then every badge (`badges` of them) next to the XP table
// (`earn` rows).
export default function ProgressPageSkeleton({ badges, earn }) {
  const t = useT()
  return (
    <Skeleton label={t('app.progress.loading')}>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <PixelCard className="p-6 sm:p-8">
          <Line className="font-label text-xs" width="w-20" />
          <Line className="mt-2 font-pixel text-4xl font-bold" width="w-1/2" />
          <Line className="mt-1" width="w-3/5" />
          <div className="mt-5 flex gap-[3px] border-2 border-ink bg-white p-[3px]">
            <Bone className="h-4 flex-1" />
          </div>
          <div className="mt-6 border-t-2 border-dashed border-line pt-4">
            <Line className="font-label text-[10px]" width="w-20" />
            <div className="mt-3 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((slot) => (
                <Bone key={slot} className="size-10 border-2 border-ink" />
              ))}
            </div>
          </div>
        </PixelCard>

        <div className="grid grid-cols-3 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink lg:grid-cols-1">
          {[1, 2, 3].map((slot) => (
            <div key={slot} className="bg-white px-4 py-3">
              <Line className="font-label text-xs leading-6" width="w-16" />
              <Line className="mt-1 pt-1 font-pixel text-lg font-bold leading-none sm:text-2xl" width="w-14" />
              <Line className="text-xs leading-6" width="w-12" />
            </div>
          ))}
        </div>
      </div>

      <ActivityGraphSkeleton className="mt-14" />

      <SkillMapSkeleton className="mt-14" />

      <div className="mt-14 grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Line className="font-pixel text-2xl font-bold" width="w-32" />
            <Line className="font-label text-xs" width="w-20" />
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: badges }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative badges
              <li key={index} className="flex flex-col items-center border-2 border-dashed border-muted/60 bg-mist p-4">
                <Bone className="size-16 border-2 border-muted/50" />
                <Line className="mt-3 w-full justify-center font-pixel text-lg leading-tight" width="w-2/3" />
                <Line className="mt-1 w-full justify-center text-xs" width="w-4/5" />
                <Bone className="mt-3 h-[19px] w-14" />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex min-h-8 items-end">
            <Line className="font-label text-sm" width="w-32" />
          </div>
          <ul className="mt-6 divide-y-2 divide-dashed divide-line border-2 border-ink bg-white">
            {Array.from({ length: earn }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative rows
              <li key={index} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <Line className="flex-1 text-sm" width="w-3/5" />
                <Line className="font-label text-xs" width="w-12" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Skeleton>
  )
}
