import PersonCardSkeleton from '../../components/profile/person-card/person-card-skeleton.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Line, Lines } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// A shared note while it opens: the kicker, the note's card (title, date, rule, a few paragraphs)
// and the author's card under it.
export default function PublicNotePageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('landing.note.loading')}>
      <Line className="font-label text-xs" width="w-28" />
      <PixelCard className="mt-4 p-5 sm:p-10">
        <Line className="font-pixel text-3xl leading-[1.1] font-bold sm:text-[40px]" width="w-3/4" />
        <Line className="mt-3 font-label text-[10px]" width="w-36" />
        <div className="mt-6 mb-6 h-0.5 bg-ink" />
        <div className="space-y-4">
          <Lines count={3} />
          <Lines count={2} />
          <Lines count={3} />
        </div>
      </PixelCard>
      <div className="mt-10 max-w-md">
        <Line className="mb-3 font-label text-xs" width="w-24" />
        <PersonCardSkeleton />
      </div>
    </Skeleton>
  )
}
