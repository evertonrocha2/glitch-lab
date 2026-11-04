import Skeleton, { Bone, Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// The exam page while it loads: two areas with a few topics each.
export default function ExamPageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('exams.loading')} className="mt-8 space-y-10">
      {[4, 3].map((rows) => (
        <div key={rows}>
          <Line className="font-pixel text-xl font-bold" width="w-40" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: rows }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows
              <Bone key={index} className="h-16 border-2 border-line" />
            ))}
          </div>
        </div>
      ))}
    </Skeleton>
  )
}
