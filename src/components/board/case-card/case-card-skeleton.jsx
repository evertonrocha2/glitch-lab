import { Bone, Line, Lines } from '../../ui/skeleton/skeleton.jsx'

// A case card while the board loads: the stripe, the concept and language tags, the error type,
// two lines of message and the challenges footer.
export default function CaseCardSkeleton() {
  return (
    <div className="flex w-full overflow-hidden border-2 border-ink bg-white shadow-pixel-muted">
      <Bone className="w-1.5 shrink-0" />
      <div className="min-w-0 flex-1 p-3.5">
        <div className="flex items-center gap-1.5">
          <Bone className="h-5 w-24" />
          <Bone className="h-5 w-14" />
        </div>
        <Line className="mt-2.5 font-pixel text-lg font-bold leading-tight" width="w-1/2" />
        <div className="mt-1">
          <Lines count={2} className="font-mono text-sm leading-snug" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t-2 border-dashed border-line pt-2.5 text-xs">
          <Line className="text-xs" width="w-24" />
          <Line className="text-xs" width="w-12" />
        </div>
      </div>
    </div>
  )
}
