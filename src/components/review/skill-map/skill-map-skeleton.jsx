import { CONCEPTS } from '../../../../shared/concepts.js'
import { Bone, Line, Lines } from '../../ui/skeleton/skeleton.jsx'

// The skill map while it loads (blocks only: it goes inside a page's Skeleton): the heading, the
// lead, the weakest-spot box and one row per bug type, each a name, a bar and a percentage.
export default function SkillMapSkeleton({ className = '' }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Line className="font-pixel text-2xl font-bold" width="w-48" />
        <Line className="text-sm" width="w-56" />
      </div>
      <div className="mt-2 max-w-2xl">
        <Lines count={2} />
      </div>
      <div className="mt-5 border-2 border-ink bg-white p-4 shadow-pixel sm:p-5">
        <div className="mb-5 flex flex-col gap-3 border-2 border-ink bg-secondary-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <Line className="flex-1" width="w-3/5" />
          <Bone className="h-10 w-24" />
        </div>
        <ul className="space-y-2.5">
          {CONCEPTS.map((concept) => (
            <li key={concept.id} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)_3rem]">
              <Line className="col-span-2 text-sm sm:col-span-1" width="w-28" />
              <Bone className="h-4 w-full" />
              <Line className="justify-end font-label text-xs" width="w-8" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
