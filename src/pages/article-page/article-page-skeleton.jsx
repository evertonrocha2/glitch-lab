import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Line, Lines } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

function Author({ size }) {
  return (
    <span className="flex items-center gap-2.5">
      <Bone className={`shrink-0 border-2 border-ink ${size}`} />
      <span className="leading-tight">
        <Line className="font-semibold leading-tight" width="w-28" />
        <Line className="text-xs" width="w-20" />
      </span>
    </span>
  )
}

// An article while it opens: the article's card (tags, title, author, body, reactions) and the
// comments under it.
export default function ArticlePageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('notes.article.opening')} className="mt-6">
      <PixelCard className="p-5 sm:p-10">
        <div className="flex gap-1.5">
          <Bone className="h-5 w-16" />
          <Bone className="h-5 w-20" />
        </div>
        <Line className="mt-4 font-pixel text-3xl font-bold leading-tight sm:text-4xl" width="w-4/5" />
        <div className="mt-5">
          <Author size="size-10" />
        </div>
        <div className="mt-8 space-y-4">
          <Lines count={4} />
          <Lines count={3} />
          <Lines count={2} />
        </div>
        <div className="mt-10 border-t-2 border-dashed border-line pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Bone className="h-10 w-24" />
            <Bone className="h-10 w-24" />
            <Bone className="h-10 w-24" />
          </div>
          <Line className="mt-3 text-xs" width="w-1/2" />
        </div>
      </PixelCard>

      <div className="mt-12">
        <Line className="font-pixel text-2xl font-bold" width="w-40" />
        <ul className="mt-5 space-y-3">
          {[1, 2].map((slot) => (
            <li key={slot} className="border-2 border-ink bg-white p-4">
              <Author size="size-7" />
              <div className="mt-3">
                <Lines count={2} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Skeleton>
  )
}
