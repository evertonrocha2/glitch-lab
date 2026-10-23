import PixelCard from '../../ui/pixel-card/pixel-card.jsx'
import { Bone, Line } from '../../ui/skeleton/skeleton.jsx'

// A person card while it loads: avatar, name and handle, role and headline, language tags.
export default function PersonCardSkeleton({ className = '' }) {
  return (
    <PixelCard tone="secondary" className={`flex h-full flex-col p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <Bone className="size-12 shrink-0 border-2 border-ink" />
        <div className="min-w-0 flex-1">
          <Line className="font-pixel text-xl font-bold leading-tight" width="w-3/5" />
          <Line className="font-label text-[10px]" width="w-20" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <Bone className="h-[23px] w-12" />
        <Line className="flex-1 text-sm" width="w-3/5" />
      </div>
      <div className="mt-auto flex gap-1.5 pt-3">
        <Bone className="h-[22px] w-14" />
        <Bone className="h-[22px] w-12" />
      </div>
    </PixelCard>
  )
}
