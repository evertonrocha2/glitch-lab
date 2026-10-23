import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Field, Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// Your event while it opens for editing: the form's card (title, summary, dates, description,
// rules, prizes) next to the kind and tags card, the requirements card and the save button.
export default function EventEditorPageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('events.editor.loading')} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <PixelCard className="min-w-0 space-y-6 p-5 sm:p-7">
        <Field label="w-16" box="h-[52px]" />
        <Field label="w-20" />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="w-16" />
          <Field label="w-16" />
        </div>
        <Field label="w-24" box="h-[184px]" />
        <Field label="w-16" box="h-[124px]" />
      </PixelCard>

      <div className="space-y-5">
        <PixelCard tone="secondary" className="p-5">
          <Field label="w-12" box="h-[44px]" />
          <Field className="mt-5" label="w-12" box="h-[46px]" />
          <Line className="mt-1.5 text-xs" width="w-3/4" />
        </PixelCard>
        <PixelCard tone="secondary" className="p-5">
          <Line className="font-label text-xs" width="w-28" />
          <div className="mt-3 space-y-3">
            <Bone className="h-10 w-full" />
            <Bone className="h-10 w-full" />
            <Bone className="h-10 w-full" />
          </div>
        </PixelCard>
        <Bone className="h-11 w-full" />
      </div>
    </Skeleton>
  )
}
