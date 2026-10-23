import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Line, Lines } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// The notebook while the notes load: the list on the left and, on the right, the open note's
// card (with a note in the address) or the "pick a note" box. Phones show one side, like the page.
export default function NotesPageSkeleton({ withNote = false }) {
  const t = useT()
  return (
    <Skeleton label={t('notes.loading')} className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <div className={withNote ? 'hidden lg:block' : ''}>
        <ul className="space-y-2">
          {['w-3/4', 'w-2/3', 'w-4/5', 'w-1/2'].map((width) => (
            <li key={width} className="border-2 border-ink bg-white px-3 py-2.5">
              <Line className="font-semibold" width={width} />
              <Line className="text-xs" width="w-2/5" />
            </li>
          ))}
        </ul>
      </div>

      <div className={withNote ? '' : 'hidden lg:block'}>
        {withNote ? (
          <PixelCard className="p-5 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Line className="font-label text-[10px]" width="w-16" />
              <div className="flex gap-2">
                <Bone className="h-9 w-20" />
                <Bone className="h-9 w-20" />
              </div>
            </div>
            <div className="mt-4 border-2 border-line bg-mist px-3 py-2.5">
              <Line className="text-xs leading-6" width="w-2/3" />
            </div>
            <Line className="mt-5 font-pixel text-3xl font-bold sm:text-4xl" width="w-1/2" />
            <div className="mt-6 space-y-4">
              <Lines count={3} />
              <Lines count={2} />
            </div>
          </PixelCard>
        ) : (
          <div className="grid min-h-64 place-items-center border-2 border-dashed border-ink/40 p-8">
            <Line className="w-full max-w-sm justify-center" width="w-3/4" />
          </div>
        )}
      </div>
    </Skeleton>
  )
}
