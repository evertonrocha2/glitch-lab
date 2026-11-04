import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// A topic's practice while its questions load: one question card.
export default function ExamTopicPageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('exams.topic.loading')} className="mt-8">
      <PixelCard className="p-4 sm:p-6">
        <Line className="font-label text-[10px]" width="w-48" />
        <Line className="mt-4" width="w-full" />
        <Line className="mt-2" width="w-5/6" />
        <Line className="mt-2" width="w-2/3" />
        <div className="mt-5 space-y-2">
          {['A', 'B', 'C', 'D', 'E'].map((letter) => (
            <Bone key={letter} className="h-14 border-2 border-line" />
          ))}
        </div>
      </PixelCard>
    </Skeleton>
  )
}
