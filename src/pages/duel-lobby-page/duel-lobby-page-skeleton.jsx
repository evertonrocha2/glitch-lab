import LeaderboardSkeleton from '../../components/daily/leaderboard/leaderboard-skeleton.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// The lobby's right column while it loads (the play card on the left needs no data): my rating,
// my recent duels and the leaderboard.
export default function DuelLobbySideSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('duel.lobby.loading')} className="space-y-8">
      <PixelCard tone="secondary" className="p-5">
        <Line className="font-label text-xs" width="w-24" />
        <Line className="mt-2 font-pixel text-5xl font-bold leading-none" width="w-28" />
        <Line className="mt-2 font-label text-xs" width="w-36" />
        <Line className="mt-3 text-sm" width="w-4/5" />
      </PixelCard>

      <div>
        <Line className="font-pixel text-xl font-bold" width="w-36" />
        <ul className="mt-3 border-2 border-ink bg-white shadow-pixel-ink">
          {[1, 2, 3].map((slot) => (
            <li key={slot} className="flex items-center gap-3 border-b-2 border-ink px-3 py-2.5 last:border-b-0">
              <Bone className="size-7 shrink-0 border-2 border-ink" />
              <span className="min-w-0 flex-1">
                <Line className="text-sm font-semibold" width="w-3/5" />
                <Line className="font-label text-[10px]" width="w-10" />
              </span>
              <Line className="font-mono text-sm" width="w-10" />
            </li>
          ))}
        </ul>
      </div>

      <LeaderboardSkeleton title="font-pixel text-xl font-bold" />
    </Skeleton>
  )
}
