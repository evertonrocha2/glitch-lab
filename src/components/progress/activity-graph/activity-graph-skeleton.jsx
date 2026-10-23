import { WEEKS } from '../../../../shared/activity.js'
import { Bone, Line } from '../../ui/skeleton/skeleton.jsx'

// The graph's drawing size (see activity-graph.jsx): a gray board of the same shape.
const WIDTH = 30 + WEEKS * 14
const HEIGHT = 18 + 7 * 14

// The activity graph while it loads (blocks only: it goes inside a page's Skeleton).
export default function ActivityGraphSkeleton({ className = '' }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Line className="font-pixel text-2xl font-bold" width="w-40" />
        <Line className="text-sm" width="w-48" />
      </div>
      <div className="mt-5 border-2 border-ink bg-white p-4 shadow-pixel">
        <div className="overflow-hidden pb-1">
          <Bone className="w-full" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}`, minWidth: WIDTH }} />
        </div>
        <div className="mt-3 flex justify-end">
          <Line className="font-label text-[10px]" width="w-32" />
        </div>
      </div>
    </div>
  )
}
