import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Field, Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// Your article while it opens for editing: the form's card (title, tags, write/preview tabs and
// the body) next to the linked case card and the save button.
export default function ArticleEditorPageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('notes.editorPage.loading')} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <PixelCard className="min-w-0 p-5 sm:p-7">
        <Field label="w-16" box="h-[52px]" />
        <Field className="mt-6" label="w-12" box="h-[46px]" />
        <Line className="mt-1.5 text-xs" width="w-1/2" />
        <div className="mt-6 flex items-end justify-between gap-3">
          <Bone className="h-[32px] w-40" />
          <Line className="font-label text-[10px]" width="w-16" />
        </div>
        <div className="mt-3 h-[400px] border-2 border-ink bg-white" />
        <Line className="mt-1.5 text-xs" width="w-2/3" />
      </PixelCard>

      <div className="space-y-5">
        <PixelCard tone="secondary" className="p-5">
          <Field label="w-24" box="h-[44px]" />
          <Line className="mt-2 text-xs" width="w-4/5" />
        </PixelCard>
        <Bone className="h-11 w-full" />
      </div>
    </Skeleton>
  )
}
