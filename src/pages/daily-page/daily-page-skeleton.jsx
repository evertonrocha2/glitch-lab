import LeaderboardSkeleton from '../../components/daily/leaderboard/leaderboard-skeleton.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Line, Lines } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// A teaser link (Glitchdle, line hunt): a 56px tile, a kicker, a title and a lead.
// lead: how many lines its lead takes on a wide screen.
function Teaser({ shadow, lead = 1, className = '' }) {
  return (
    <div className={`flex items-center gap-4 border-2 border-ink bg-white p-4 sm:gap-5 sm:p-5 ${shadow} ${className}`}>
      <Bone className="size-14 shrink-0 border-2 border-ink" />
      <div className="min-w-0 flex-1">
        <Line className="font-label text-[10px]" width="w-24" />
        <Line className="mt-0.5 font-pixel text-xl font-bold" width="w-40" />
        <div className="mt-0.5">
          <Lines count={lead} className="text-sm" last="w-1/3" />
        </div>
      </div>
      <Line className="hidden font-label text-xs sm:flex" width="w-12" />
    </div>
  )
}

function PuzzleCardSkeleton() {
  return (
    <PixelCard tone="muted" className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <Bone className="h-3.5 w-12" />
        <Line className="font-label text-[10px]" width="w-12" />
      </div>
      <Line className="mt-3 font-pixel text-xl font-bold leading-tight" width="w-4/5" />
      <div className="mt-3 flex items-center gap-2">
        <Bone className="h-[22px] w-16" />
        <Bone className="h-5 w-24" />
      </div>
      <div className="mt-3">
        <Lines count={2} className="font-mono text-xs leading-relaxed" />
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <Line className="text-xs" width="w-20" />
        <Bone className="h-10 w-20" />
      </div>
    </PixelCard>
  )
}

// Today's page while it loads, in its own grid: the counters next to the Glitchdle, the three
// puzzle cards and the line hunt (phones: counters, cases, Glitchdle, hunt).
export default function DailyPageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('board.daily.loading')} className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
      <div className="grid grid-cols-3 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink">
        {[1, 2, 3].map((slot) => (
          <div key={slot} className="min-w-0 bg-white px-3 py-3 sm:px-4">
            <Line className="font-label text-[10px] leading-6 sm:text-xs sm:leading-6" width="w-14" />
            <Line className="mt-1 pt-1 font-pixel text-lg font-bold leading-none sm:text-2xl" width="w-12" />
            <Line className="text-xs leading-6" width="w-4/5" />
          </div>
        ))}
      </div>

      <Teaser shadow="shadow-pixel" lead={3} className="order-last lg:order-none" />

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-3 lg:col-span-2">
        {[1, 2, 3].map((slot) => (
          <PuzzleCardSkeleton key={slot} />
        ))}
      </div>

      <Teaser shadow="shadow-pixel-secondary" className="order-last lg:col-span-2" />
    </Skeleton>
  )
}

// The week's global challenge while it loads: the heading, the challenge card and its leaderboard.
// It loads with today's set, whose Skeleton already tells screen readers, so this one stays quiet.
export function GlobalChallengeSkeleton() {
  return (
    <div aria-hidden="true" className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Line className="font-label text-xs" width="w-28" />
          <Line className="mt-1 font-pixel text-2xl font-bold sm:text-3xl" width="w-56" />
        </div>
        <Line className="font-label text-xs" width="w-28" />
      </div>
      <Line className="mt-2 max-w-2xl" width="w-4/5" />

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="border-2 border-ink bg-white shadow-pixel-secondary">
          <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-secondary px-5 py-2">
            <Line className="font-label text-xs" width="w-24" />
          </div>
          <div className="p-5 sm:p-6">
            <Line className="font-pixel text-2xl font-bold leading-tight sm:text-3xl" width="w-3/4" />
            <div className="mt-3 flex items-center gap-2">
              <Bone className="h-[22px] w-16" />
              <Bone className="h-5 w-24" />
            </div>
            <div className="mt-4 border-2 border-ink bg-mist px-3 py-2">
              <Lines count={2} className="font-mono text-xs leading-relaxed" />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <Line className="font-label text-xs" width="w-32" />
                <Line className="text-xs" width="w-20" />
              </div>
              <Bone className="h-11 w-24" />
            </div>
          </div>
        </div>
        <LeaderboardSkeleton />
      </div>
    </div>
  )
}
