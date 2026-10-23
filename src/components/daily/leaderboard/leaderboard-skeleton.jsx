import { Bone, Line } from '../../ui/skeleton/skeleton.jsx'

// A leaderboard while it loads (blocks only: it goes inside a page's Skeleton). The daily, hunt
// and duel boards share this shape: a title, then rows of rank, face, name and score.
// title: the classes of the board's own heading, so the gray line is as tall as it.
export default function LeaderboardSkeleton({ rows = 5, title = 'font-label text-xs' }) {
  return (
    <div>
      <Line className={title} width="w-40" />
      <ol className="mt-3 border-2 border-ink bg-white shadow-pixel-ink">
        {Array.from({ length: rows }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative rows
          <li key={index} className="flex items-center gap-3 border-b-2 border-ink px-3 py-2.5 last:border-b-0">
            <Line className="w-7 shrink-0 font-label text-sm" width="w-5" />
            <Bone className="size-8 shrink-0 border-2 border-ink" />
            <Line className="min-w-0 flex-1 font-semibold" width="w-3/5" />
            <span className="flex shrink-0 flex-col items-end">
              <Line className="font-mono text-sm" width="w-12" />
              <Line className="text-xs" width="w-16" />
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
