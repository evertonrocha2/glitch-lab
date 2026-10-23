import PixelCard from '../../ui/pixel-card/pixel-card.jsx'
import { Bone, Line } from '../../ui/skeleton/skeleton.jsx'
import { DASHED_ACROSS, DASHED_DOWN } from './trail-map.jsx'

// The mission path while it loads (blocks only: it goes inside a page's Skeleton): the same dashed
// line, nodes and zig-zag of cards as TrailMap.
export default function TrailMapSkeleton({ count = 4 }) {
  return (
    <ol className="relative mt-10 flex flex-col gap-8">
      <span className={`absolute top-6 bottom-6 left-5.5 w-1 ${DASHED_DOWN} md:left-1/2 md:-translate-x-1/2`} />
      {Array.from({ length: count }, (_, index) => {
        const side = index % 2 === 0 ? 'left' : 'right'
        return (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative missions
            key={index}
            className={`relative grid grid-cols-[48px_minmax(0,1fr)] items-start gap-4 md:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] md:gap-6 ${index > 0 ? 'md:-mt-18' : ''}`}
          >
            <div className="col-start-1 row-start-1 pt-1 md:col-start-2">
              <span className="relative z-10 grid size-12 place-items-center border-2 border-ink/50 bg-white">
                <Bone className="size-4" />
              </span>
            </div>
            <div className={`col-start-2 row-start-1 ${side === 'left' ? 'md:col-start-1' : 'md:col-start-3'}`}>
              <div className="relative min-w-0">
                <span className={`absolute top-7 -left-4 h-1 w-4 ${DASHED_ACROSS} md:w-6 ${side === 'left' ? 'md:left-auto md:-right-6' : 'md:-left-6'}`} />
                <PixelCard tone="muted" className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <Bone className="size-5" />
                      <Line className="font-label text-[10px]" width="w-16" />
                    </span>
                    <Bone className="h-[22px] w-14" />
                  </div>
                  <Line className="mt-3 font-pixel text-xl leading-tight" width="w-3/4" />
                  <Line className="mt-1.5 text-sm" width="w-full" />
                  <Line className="text-sm" width="w-1/2" />
                  <Bone className="mt-3 h-[19px] w-28" />
                  <div className="mt-4 flex items-center justify-between gap-3 border-t-2 border-dashed border-line pt-3">
                    <Bone className="h-[19px] w-14" />
                    <Bone className="h-9 w-24" />
                  </div>
                </PixelCard>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
