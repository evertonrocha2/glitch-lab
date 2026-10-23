import Skeleton, { Bone, Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// The interrogation while it loads: the case card (right on desktop, first on phones), the six
// steps and the question's card, in the page's own grid.
export default function InterrogationPageSkeleton({ steps }) {
  const t = useT()
  return (
    <Skeleton label={t('interrogation.page.loading')} className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="min-w-0 border-2 border-ink bg-mist p-5 lg:order-last">
        <Line className="font-label text-xs" width="w-16" />
        <Line className="mt-3 font-pixel text-xl font-bold" width="w-1/2" />
        <div className="mt-2 border-2 border-ink bg-white p-3">
          <Line className="font-mono text-xs leading-relaxed" width="w-4/5" />
        </div>
        <div className="mt-3 flex gap-1.5">
          <Bone className="h-5 w-24" />
          <Bone className="h-5 w-16" />
        </div>
        <div className="mt-4 border-2 border-ink bg-white px-4 py-3">
          <Line className="font-label text-xs leading-4" width="w-24" />
        </div>
      </div>

      <div className="min-w-0 space-y-6">
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Array.from({ length: steps }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: one block per step
            <li key={index} className="flex min-h-14 flex-col justify-between gap-1 border-2 border-ink bg-white px-2 py-1.5">
              <Line className="font-label text-[10px]" width="w-2" />
              <Line className="font-label text-[10px] leading-tight" width="w-4/5" />
            </li>
          ))}
        </ol>

        <div className="border-2 border-ink bg-white p-5 shadow-pixel sm:p-6">
          <Line className="font-label text-xs" width="w-20" />
          <Line className="mt-2 font-pixel text-2xl font-bold" width="w-1/2" />
          <Line className="mt-2" width="w-4/5" />
          <Line className="mt-5 font-label text-xs" width="w-24" />
          <div className="mt-2 h-[120px] border-2 border-ink bg-white" />
          <Line className="mt-2 text-sm" width="w-2/3" />
          <Bone className="mt-4 h-11 w-28" />
        </div>
      </div>
    </Skeleton>
  )
}
