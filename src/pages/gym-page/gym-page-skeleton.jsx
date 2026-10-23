import Skeleton, { Bone, Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// Six lines of code, the editor's shortest.
const CODE = ['w-2/5', 'w-3/5', 'w-1/2', 'w-2/3', 'w-1/3', 'w-1/2']

// A challenge while it loads: the symptom, the fix editor and the submit button next to the hints
// card, in the gym's own grid.
export default function GymPageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('board.gym.loading')} className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <div className="border-2 border-ink bg-primary-soft">
          <div className="border-b-2 border-ink bg-primary px-4 py-2">
            <Line className="font-label text-xs" width="w-20" />
          </div>
          <div className="flex gap-2.5 px-4 py-3">
            <Line className="flex-1 font-mono text-sm leading-relaxed" width="w-4/5" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <Line className="font-label text-xs" width="w-20" />
            <Bone className="h-[22px] w-16" />
          </div>
          <div className="mt-2 flex border-2 border-ink bg-white">
            <div className="border-r-2 border-ink bg-mist px-2.5 py-3">
              {CODE.map((_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative line numbers
                <Line key={index} className="font-mono text-sm leading-relaxed" width="w-2" />
              ))}
            </div>
            <div className="min-w-0 flex-1 px-3 py-3">
              {CODE.map((width, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative code lines
                <Line key={index} className="font-mono text-sm leading-relaxed" width={width} />
              ))}
            </div>
          </div>
        </div>

        <Bone className="h-11 w-36" />
      </div>

      <div className="border-2 border-ink bg-primary-soft p-5 shadow-pixel">
        <div className="flex items-center justify-between gap-3">
          <Line className="font-label text-sm" width="w-16" />
          <Bone className="h-10 w-28" />
        </div>
        <Line className="mt-3 text-sm" width="w-4/5" />
      </div>
    </Skeleton>
  )
}
