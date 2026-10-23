import ProfileCardSkeleton from '../../components/profile/profile-card/profile-card-skeleton.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import Skeleton, { Bone, Field, Line } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// A row of chip-sized blocks (roles, languages, open to).
function Chips({ widths }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {widths.map((width, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative chips
        <Bone key={index} className={`h-9 ${width}`} />
      ))}
    </div>
  )
}

// The profile editor while the profile loads: the live preview card on one side (on top on phones)
// and the form's card on the other, in the page's own grid.
export default function ProfilePageSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('app.profile.loading')} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
      <section className="lg:sticky lg:top-6 lg:order-last">
        <Line className="mb-3 font-label text-xs" width="w-32" />
        <ProfileCardSkeleton />
        <Line className="mt-3 text-xs" width="w-3/4" />
      </section>

      <PixelCard tone="secondary" className="space-y-6 p-5 sm:p-7">
        <Field label="w-28" />
        <div>
          <Field label="w-16" />
          <Line className="mt-1.5 text-xs" width="w-2/3" />
        </div>
        <Field label="w-12" box="h-24" />

        <div className="space-y-5 border-t-2 border-dashed border-line pt-5">
          <div>
            <Line className="font-pixel text-xl font-bold" width="w-32" />
            <Line className="mt-1 text-sm" width="w-3/4" />
          </div>
          <div>
            <Line className="font-label text-xs" width="w-20" />
            <Chips widths={['w-20', 'w-24', 'w-16', 'w-28', 'w-20']} />
          </div>
          <Field label="w-24" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="w-24" />
            <Field label="w-20" />
            <Field label="w-16" />
            <Field label="w-20" />
          </div>
        </div>
      </PixelCard>
    </Skeleton>
  )
}
