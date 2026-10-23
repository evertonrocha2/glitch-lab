import { Bone, Line, Lines } from '../../ui/skeleton/skeleton.jsx'

// An article card while the list loads: tags, title, excerpt and the author and counts footer.
export default function ArticleCardSkeleton() {
  return (
    <div className="flex w-full min-w-0 flex-col border-2 border-ink bg-white p-4 shadow-pixel-muted sm:p-5">
      <div className="mb-3 flex gap-1.5">
        <Bone className="h-5 w-16" />
        <Bone className="h-5 w-20" />
      </div>
      <Line className="font-pixel text-xl font-bold leading-tight sm:text-2xl" width="w-3/4" />
      <div className="mt-2">
        <Lines count={3} className="text-sm" />
      </div>
      <span className="min-h-4 flex-1" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-line pt-3">
        <span className="flex items-center gap-2.5">
          <Bone className="size-7 shrink-0 border-2 border-ink" />
          <span className="leading-tight">
            <Line className="font-semibold leading-tight" width="w-24" />
            <Line className="text-xs" width="w-16" />
          </span>
        </span>
        <Line className="font-label text-xs" width="w-28" />
      </div>
    </div>
  )
}
