import Frame from '../../components/game/ui/frame.jsx'
import Skeleton from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// A dark bar that breathes, the game's own skeleton color.
const BONE = 'block bg-[#2a2250] motion-safe:animate-skeleton'

// Glitch World while it loads: the game console with the dark stage, its status line and the panel
// beside it, in the same grid the map arrives in.
export default function WorldPageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('world.page.loading')}>
      <Frame tone="panel" className="mt-6 grid items-start gap-2 p-1.5 shadow-pixel lg:grid-cols-[minmax(0,1fr)_20rem] lg:p-2">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="block aspect-[3/2] w-full border-2 border-[#120c22] bg-[#05040c]" />
          <Frame tone="inset" className="flex min-h-14 items-center px-3 py-2">
            <span className={`${BONE} h-2.5 w-1/2`} />
          </Frame>
        </div>
        <div className="flex flex-col gap-3 p-1 lg:p-2">
          <span className={`${BONE} h-2.5 w-32`} />
          <span className={`${BONE} h-16 w-full`} />
          <span className={`${BONE} mt-2 h-2.5 w-24`} />
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <span key={item} className={`${BONE} h-9 w-full`} />
          ))}
        </div>
      </Frame>
    </Skeleton>
  )
}
