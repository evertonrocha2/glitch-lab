import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// The study log while it loads: the week card, then two days of sessions.
export default function StudyPageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('study.loading')} className="mt-8">
      <PixelCard className="grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:p-6">
        <div>
          <Line className="font-label text-xs" width="w-20" />
          <Line className="mt-2 font-pixel text-4xl font-bold" width="w-28" />
          <Line className="mt-1 text-sm" width="w-40" />
          <Line className="mt-3 text-sm" width="w-24" />
        </div>
        <div className="space-y-3">
          <Line className="font-label text-xs" width="w-24" />
          {[1, 2, 3].map((slot) => (
            <div key={slot}>
              <Line className="text-sm" width="w-1/2" />
              <Bone className="mt-1 h-2 border border-ink" />
            </div>
          ))}
        </div>
      </PixelCard>
      {[3, 2].map((rows) => (
        <div key={rows} className="mt-10">
          <Line className="font-pixel text-lg font-bold" width="w-40" />
          <div className="mt-3 space-y-3">
            {Array.from({ length: rows }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative rows
              <div key={index} className="border-2 border-ink bg-white px-3 py-2.5 sm:px-4">
                <Line className="font-label text-xs" width="w-28" />
                <Line className="mt-1" width="w-2/3" />
                <Line className="mt-1 leading-10" width="w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Skeleton>
  )
}
