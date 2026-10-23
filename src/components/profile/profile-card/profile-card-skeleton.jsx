import PixelCard from '../../ui/pixel-card/pixel-card.jsx'
import { Bone, Line, Lines } from '../../ui/skeleton/skeleton.jsx'

// The profile card while the profile loads: the same frame, avatar, name, level, bio, XP bar and
// featured badges, in gray. "large" matches the public page, the default the editor's preview.
export default function ProfileCardSkeleton({ large = false }) {
  return (
    <PixelCard className={`relative overflow-hidden ${large ? 'p-6 sm:p-8' : 'p-5'}`}>
      <div className="flex items-center gap-4 sm:gap-5">
        <Bone className={`shrink-0 border-2 border-ink ${large ? 'size-20 sm:size-28' : 'size-16'}`} />
        <div className="min-w-0 flex-1">
          <Line className={`font-pixel font-bold leading-tight ${large ? 'text-3xl sm:text-4xl' : 'text-2xl'}`} width="w-3/5" />
          <Line className="mt-1 font-label text-xs" width="w-24" />
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Bone className="h-3.5 w-12" />
            <Line className="font-label text-xs" width="w-28" />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Bone className="h-[23px] w-20" />
        <Line className={`flex-1 font-semibold ${large ? 'text-lg' : ''}`} width="w-3/5" />
      </div>

      <div className="mt-5">
        <Lines count={2} className={large ? 'text-lg' : 'text-base'} />
      </div>

      <div className="mt-5 space-y-4 border-t-2 border-dashed border-line pt-4">
        <div className="space-y-1.5">
          {['w-3/4', 'w-1/2', 'w-2/5'].map((width) => (
            <div key={width} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-4">
              <Line className={`font-label text-[10px] ${large ? 'leading-6' : 'leading-5'}`} width="w-14" />
              <Line className={large ? 'text-base' : 'text-sm'} width={width} />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Bone className="h-6 w-20" />
          <Bone className="h-6 w-14" />
          <Bone className="h-6 w-10" />
        </div>
        <div className="flex items-center gap-1.5">
          <Line className="mr-1 font-label text-[10px]" width="w-12" />
          <Bone className="h-5 w-28" />
          <Bone className="h-5 w-20" />
        </div>
      </div>

      <div className="mt-5">
        <div className="flex gap-[3px] border-2 border-ink bg-white p-[3px]">
          <Bone className="h-3 flex-1" />
        </div>
        <Line className="mt-1.5 font-label text-[10px]" width="w-40" />
      </div>

      <div className="mt-5 border-t-2 border-dashed border-line pt-4">
        <Line className="font-label text-[10px]" width="w-24" />
        <ul className="mt-3 grid grid-cols-3 gap-3">
          {[1, 2, 3].map((slot) => (
            <li key={slot} className="flex min-w-0 flex-col items-center">
              <Bone className={`border-2 border-ink ${large ? 'size-20 sm:size-24' : 'size-14'}`} />
              <Line className={`mt-2 w-full justify-center font-pixel leading-tight ${large ? 'text-base sm:text-lg' : 'text-sm'}`} width="w-3/4" />
            </li>
          ))}
        </ul>
      </div>
    </PixelCard>
  )
}
