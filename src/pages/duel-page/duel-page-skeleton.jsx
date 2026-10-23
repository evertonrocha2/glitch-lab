import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// A duel while it loads: the two players' score cards side by side and the round's card under them.
export default function DuelPageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('duel.loading')} className="mt-8 space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        {['primary', 'secondary'].map((tone) => (
          <PixelCard key={tone} tone={tone} className="h-full p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Bone className="size-7 shrink-0 border-2 border-ink sm:size-8" />
              <Line className="flex-1 font-label text-xs sm:text-sm" width="w-3/5" />
            </div>
            <Line className="mt-2 font-pixel text-3xl font-bold leading-none sm:text-4xl" width="w-10" />
          </PixelCard>
        ))}
      </div>
      <PixelCard className="p-5 sm:p-6">
        <Line className="font-label text-xs" width="w-28" />
        <Line className="mt-2 font-pixel text-2xl font-bold" width="w-3/4" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((slot) => (
            <Bone key={slot} className="h-12" />
          ))}
        </div>
      </PixelCard>
    </Skeleton>
  )
}
