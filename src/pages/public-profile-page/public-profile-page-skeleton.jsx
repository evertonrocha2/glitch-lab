import ActivityGraphSkeleton from '../../components/progress/activity-graph/activity-graph-skeleton.jsx'
import ProfileCardSkeleton from '../../components/profile/profile-card/profile-card-skeleton.jsx'
import Skeleton, { Bone, Line, Lines } from '../../components/ui/skeleton/skeleton.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

const STATS = ['streak', 'studied', 'cases', 'solved', 'gym']
const NOTES_GRID = 'mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

function NoteCards() {
  return [1, 2, 3].map((slot) => (
    <div key={slot} className="flex h-full flex-col border-2 border-ink bg-white p-4 shadow-pixel-ink">
      <Line className="font-pixel text-lg leading-tight" width="w-3/4" />
      <div className="mt-2">
        <Lines count={2} className="text-sm" />
      </div>
      <Line className="mt-auto pt-3 font-label text-[10px]" width="w-28" />
    </div>
  ))
}

// The shared notes while they load (the profile is already showing): the same grid of note cards.
export function PublicNotesSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('landing.profile.notesLoading')} className={NOTES_GRID}>
      <NoteCards />
    </Skeleton>
  )
}

// A public profile while it loads: the kicker, the big card beside the stats, the activity graph,
// the shared notes and the badges.
export default function PublicProfileSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('landing.profile.loading')}>
      <Line className="font-label text-xs" width="w-28" />
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ProfileCardSkeleton large />
        <div>
          <ul className="grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink sm:grid-cols-5 lg:grid-cols-1">
            {STATS.map((id) => (
              <li key={id} className="bg-white px-4 py-3 last:col-span-2 sm:last:col-span-1">
                <Line className="font-label text-xs leading-6" width="w-16" />
                <Line className="mt-1 pt-1 font-pixel text-2xl font-bold leading-none" width="w-12" />
                <Line className="text-xs leading-6" width="w-20" />
              </li>
            ))}
          </ul>
          <Line className="mt-4 font-label text-[10px]" width="w-36" />
        </div>
      </div>

      <ActivityGraphSkeleton className="mt-14" />

      <div className="mt-14">
        <Line className="font-pixel text-2xl font-bold" width="w-48" />
        <div className={NOTES_GRID}>
          <NoteCards />
        </div>
      </div>

      <div className="mt-14">
        <Line className="font-pixel text-2xl font-bold" width="w-40" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((slot) => (
            <div key={slot} className="flex flex-col items-center border-2 border-ink bg-white p-4 shadow-pixel-ink">
              <Bone className="size-16 border-2 border-ink" />
              <Line className="mt-3 w-full justify-center font-pixel text-lg leading-tight" width="w-2/3" />
              <Line className="mt-1 w-full justify-center text-xs" width="w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </Skeleton>
  )
}
