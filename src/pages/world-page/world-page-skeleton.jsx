import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// Glitch World while it loads: the map's frame and the panel beside it, in the same grid.
export default function WorldPageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('world.page.loading')} className="mt-8 grid gap-6 lg:max-w-[65rem] lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Bone className="aspect-[3/2] w-full max-w-[720px] border-2 border-line" />
      <PixelCard tone="secondary" className="p-5">
        <Line className="font-label text-xs" width="w-32" />
        <Line className="mt-3" width="w-full" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <Line key={item} width="w-full" />
          ))}
        </div>
      </PixelCard>
    </Skeleton>
  )
}
