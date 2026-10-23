import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// The "next in" pill at the top right, while the game loads.
export function CountdownSkeleton() {
  return (
    <p aria-hidden="true" className="border-2 border-ink bg-white px-3 py-2 shadow-pixel-muted">
      <Line className="font-label text-xs" width="w-28" />
    </p>
  )
}

// Today's Glitchdle while it loads: the game card (mode tabs, intro, guess box, first board row)
// next to the sidebar's three panels, in the page's own grid.
export default function GlitchdlePageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('app.glitchdle.loading')} className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="border-2 border-ink bg-white shadow-pixel-ink">
        <div className="grid grid-cols-3 gap-[2px] border-b-2 border-ink bg-ink">
          {[1, 2, 3].map((slot) => (
            <div key={slot} className="min-w-0 bg-white px-3 py-2.5 sm:px-5">
              <Line className="font-label text-xs sm:text-sm" width="w-3/4" />
              <span className="mt-1 flex h-4 items-center">
                <Bone className="h-3 w-10" />
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <Line className="max-w-2xl text-sm" width="w-4/5" />
          <div className="flex gap-2">
            <div className="h-12 min-w-0 flex-1 border-2 border-ink bg-white" />
            <Bone className="h-12 w-24 shrink-0" />
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1">
            {[1, 2, 3, 4].map((slot) => (
              <Line key={slot} className="text-xs" width="w-16" />
            ))}
          </div>
          <div className="border-2 border-dashed border-line bg-white px-4 py-6">
            <Line className="justify-center text-sm" width="w-3/5" />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <PixelCard tone="secondary" className="p-4">
          <Line className="font-pixel text-lg font-bold" width="w-28" />
          <div className="mt-3 grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink sm:grid-cols-4 lg:grid-cols-2">
            {[1, 2, 3, 4].map((slot) => (
              <div key={slot} className="min-w-0 bg-white px-2 py-2">
                <Line className="justify-center font-pixel text-xl font-bold leading-none" width="w-8" />
                <Line className="mt-1 justify-center font-label text-[10px]" width="w-14" />
              </div>
            ))}
          </div>
          <Line className="mt-2 text-xs" width="w-4/5" />
        </PixelCard>
        <PixelCard tone="muted" className="p-4">
          <Line className="font-pixel text-lg font-bold leading-tight" width="w-40" />
          <div className="mt-3 space-y-1">
            {[1, 2, 3, 4, 5, 6].map((slot) => (
              <div key={slot} className="flex items-center gap-2 text-xs">
                <span className="w-6 shrink-0" />
                <Bone className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </PixelCard>
        <PixelCard className="p-4">
          <Line className="font-pixel text-lg font-bold" width="w-32" />
          <div className="mt-3 border-2 border-ink">
            {[1, 2, 3, 4].map((slot) => (
              <div key={slot} className="border-t-2 border-line px-1.5 py-1.5 first:border-t-0 first:bg-mist">
                <Line className="text-xs" width="w-full" />
              </div>
            ))}
          </div>
        </PixelCard>
      </div>
    </Skeleton>
  )
}
