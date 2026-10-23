import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Line, Lines } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// An event while it opens: the header card with its countdown box, then the page's grid (your
// entry and the ranking on the right, the description and the entries on the left).
export default function EventPageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('events.page.opening')} className="mt-6">
      <PixelCard className="p-5 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Bone className="h-[23px] w-20" />
              <Bone className="h-[23px] w-14" />
            </div>
            <Line className="mt-4 font-pixel text-3xl font-bold leading-tight sm:text-4xl" width="w-3/4" />
            <Line className="mt-3 max-w-2xl" width="w-4/5" />
            <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
              <div>
                <Line className="mb-1.5 font-label text-[10px]" width="w-20" />
                <span className="flex items-center gap-2.5">
                  <Bone className="size-9 shrink-0 border-2 border-ink" />
                  <span className="leading-tight">
                    <Line className="font-semibold leading-tight" width="w-28" />
                    <Line className="text-xs" width="w-16" />
                  </span>
                </span>
              </div>
              <Line className="text-xs" width="w-48" />
            </div>
          </div>
          <div className="border-2 border-ink bg-white p-4 shadow-pixel-ink lg:min-w-64">
            <Line className="font-label text-[10px]" width="w-20" />
            <Line className="font-pixel text-2xl font-bold sm:text-3xl" width="w-40" />
            <Line className="mt-2 font-label text-xs" width="w-20" />
          </div>
        </div>
      </PixelCard>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <PixelCard className="p-5">
            <Line className="font-label text-xs" width="w-24" />
            <Line className="mt-3 text-sm" width="w-4/5" />
            <Bone className="mt-4 h-10 w-full" />
          </PixelCard>
        </div>
        <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <PixelCard tone="muted" className="p-5 sm:p-8">
            <Line className="font-label text-xs" width="w-20" />
            <div className="mt-3 space-y-4">
              <Lines count={4} />
              <Lines count={2} />
            </div>
          </PixelCard>
          <div className="mt-10">
            <Line className="font-pixel text-2xl font-bold" width="w-36" />
          </div>
        </div>
        <div className="min-w-0 space-y-6 self-start lg:col-start-2 lg:row-start-2">
          <PixelCard tone="muted" className="p-5">
            <Line className="font-label text-xs" width="w-20" />
            <div className="mt-3">
              <Lines count={2} className="text-sm" />
            </div>
          </PixelCard>
        </div>
      </div>
    </Skeleton>
  )
}
