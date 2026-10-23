import LeaderboardSkeleton from '../../components/daily/leaderboard/leaderboard-skeleton.jsx'
import Skeleton, { Bone, Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// The two mode tabs in the header, while the hunt loads.
export function ModeTabsSkeleton() {
  return (
    <div aria-hidden="true" className="inline-grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink">
      {[1, 2].map((slot) => (
        <span key={slot} className="flex min-h-10 items-center bg-white px-4">
          <Bone className="h-3 w-20" />
        </span>
      ))}
    </div>
  )
}

// The line hunt while it loads: the intro card (kicker strip, title, rules, start) next to
// today's leaderboard, in the page's own grid.
export default function HuntPageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('hunt.loading')} className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 border-2 border-ink bg-white shadow-pixel">
        <div className="border-b-2 border-ink bg-secondary px-5 py-2">
          <Line className="font-label text-xs" width="w-32" />
        </div>
        <div className="p-5 sm:p-6">
          <Line className="font-pixel text-2xl font-bold sm:text-3xl" width="w-3/5" />
          <Line className="mt-2" width="w-4/5" />
          <ul className="mt-5 space-y-2 text-sm">
            {['w-4/5', 'w-3/5', 'w-2/3'].map((width) => (
              <li key={width} className="flex gap-2">
                <Bone className="mt-1.5 size-2 shrink-0" />
                <Line className="flex-1 text-sm" width={width} />
              </li>
            ))}
          </ul>
          <Line className="mt-4 text-sm" width="w-1/2" />
          <Bone className="mt-6 h-11 w-32" />
        </div>
      </div>
      <div className="space-y-6">
        <LeaderboardSkeleton />
      </div>
    </Skeleton>
  )
}
