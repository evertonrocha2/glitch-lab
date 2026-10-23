import { Bone, Line } from '../../ui/skeleton/skeleton.jsx'

// An event card while the list loads: kind and status chips, title, summary, dates and the
// organizer and countdown footer.
export default function EventCardSkeleton() {
  return (
    <div className="flex w-full min-w-0 flex-col border-2 border-ink bg-white p-4 shadow-pixel-muted sm:p-5">
      <div className="flex items-center gap-2">
        <Bone className="h-[23px] w-20" />
        <Bone className="h-[23px] w-14" />
      </div>
      <Line className="mt-3 font-pixel text-xl font-bold leading-tight sm:text-2xl" width="w-3/4" />
      <Line className="mt-2 text-sm" width="w-full" />
      <Line className="text-sm" width="w-1/2" />
      <Line className="mt-3 text-xs" width="w-40" />
      <span className="min-h-4 flex-1" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-line pt-3">
        <span className="flex items-center gap-2.5">
          <Bone className="size-7 shrink-0 border-2 border-ink" />
          <span className="leading-tight">
            <Line className="font-semibold leading-tight" width="w-24" />
            <Line className="text-xs" width="w-16" />
          </span>
        </span>
        <Line className="text-sm" width="w-24" />
      </div>
    </div>
  )
}
