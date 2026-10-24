import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { BADGES } from '../../../shared/badges.js'
import MessageButton from '../../components/chat/message-button/message-button.jsx'
import ActivityGraph from '../../components/progress/activity-graph/activity-graph.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import BadgeIcon from '../../components/ui/badge-icon/badge-icon.jsx'
import PixelBug from '../../components/ui/pixel-bug/pixel-bug.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import ProfileCard from '../../components/profile/profile-card/profile-card.jsx'
import NoteTags from '../../components/notes/note-tags/note-tags.jsx'
import PublicHeader, { TryLink } from '../../components/layout/public-header/public-header.jsx'
import { getPublicProfile, listPublicNotes } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { formatDuration, localDay } from '../../lib/day.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../../lib/i18n/format.js'
import { badgeHow, badgeName } from '../../lib/i18n/labels.js'
import PublicProfileSkeleton, { PublicNotesSkeleton } from './public-profile-page-skeleton.jsx'

// The notes this person shared. Each one opens read-only on its own page.
function PublicNotes({ handle, notes }) {
  const t = useT()
  const format = useFormat()
  return (
    <section aria-labelledby="notes-title" className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="notes-title" className="font-pixel text-2xl font-bold text-ink">
          {t('landing.profile.notes')}
        </h2>
        {notes?.length > 0 && <p className="font-label text-xs text-muted">{t('landing.profile.notesShared', { count: notes.length })}</p>}
      </div>
      {notes === null && <PublicNotesSkeleton />}
      {notes?.length === 0 && <p className="mt-4 text-sm text-muted">{t('landing.profile.notesNone')}</p>}
      {notes?.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <li key={note.id}>
              <Link
                to={`/u/${handle}/notes/${note.id}`}
                className="flex h-full flex-col border-2 border-ink bg-white p-4 shadow-pixel-ink transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
              >
                <strong className="font-pixel text-lg leading-tight wrap-break-word text-ink">{note.title || t('landing.profile.untitled')}</strong>
                {note.excerpt && <span className="mt-2 line-clamp-3 text-sm wrap-break-word text-muted">{note.excerpt}</span>}
                <NoteTags tags={note.tags} max={3} className="mt-3" />
                <span className="mt-auto pt-3 font-label text-[10px] text-secondary">
                  {t('landing.profile.blocks', { count: note.blockCount })} · {format.date(note.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// Each stat is labelled landing.profile.stat.<id>, with landing.profile.stat.<id>Note under the number.
function Stats({ profile }) {
  const t = useT()
  const items = [
    { id: 'streak', value: `${profile.streak}d`, tone: 'text-primary' },
    { id: 'studied', value: formatDuration(profile.totalSeconds), tone: 'text-secondary' },
    { id: 'cases', value: profile.counts.cases, tone: 'text-ink' },
    { id: 'solved', value: profile.counts.solved, tone: 'text-primary' },
    { id: 'gym', value: profile.counts.passedChallenges, tone: 'text-secondary' },
  ]
  return (
    <ul aria-label={t('landing.profile.stats')} className="grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink sm:grid-cols-5 lg:grid-cols-1">
      {items.map((item) => (
        <li key={item.id} className="bg-white px-4 py-3 last:col-span-2 sm:last:col-span-1">
          <span className="font-label text-xs text-muted">{t(`landing.profile.stat.${item.id}`)}</span>
          <strong className={`mt-1 block pt-1 font-pixel font-bold text-2xl leading-none ${item.tone}`}>{item.value}</strong>
          <span className="text-xs text-muted">{t(`landing.profile.stat.${item.id}Note`)}</span>
        </li>
      ))}
    </ul>
  )
}

function NotFound({ handle }) {
  const t = useT()
  return (
    <PixelCard tone="muted" className="mx-auto max-w-lg p-8 text-center">
      <PixelBug className="mx-auto h-12 w-auto" />
      <h1 className="mt-6 font-pixel text-3xl font-bold text-ink">{t('landing.profile.missingTitle')}</h1>
      <p className="mt-3 break-words text-muted">
        {t('landing.profile.missing.before')}
        <span className="font-label text-xs text-ink">@{handle}</span>
        {t('landing.profile.missing.after')}
      </p>
      <div className="mt-6">
        <TryLink />
      </div>
    </PixelCard>
  )
}

// A person's public profile: anyone can open it, signed in or not.
export default function PublicProfilePage() {
  const { handle: raw } = useParams()
  // "/u/@Ada" and "/u/ada" are the same page; the address is tidied to the plain handle.
  const handle = raw.replace(/^@+/, '').toLowerCase()
  const { getToken } = useAuth()
  const t = useT()
  const format = useFormat()
  const [state, setState] = useState({ status: 'loading' })
  const [notes, setNotes] = useState(null)

  useEffect(() => {
    let live = true
    setState({ status: 'loading' })
    setNotes(null)
    getToken()
      .then((token) => getPublicProfile(handle, localDay(), token))
      .then((found) => live && setState(found ? { status: 'ready', ...found } : { status: 'missing' }))
      .catch((err) => live && setState({ status: 'error', message: err.message }))
    // The notes are a bonus: if they can't load, the profile still shows.
    listPublicNotes(handle)
      .then((list) => live && setNotes(list ?? []))
      .catch(() => live && setNotes([]))
    return () => {
      live = false
    }
  }, [handle, getToken])

  const { profile, preview } = state
  if (raw !== handle) return <Navigate to={`/u/${handle}`} replace />
  const earned = profile ? BADGES.filter((badge) => profile.badges.includes(badge.id)) : []

  return (
    <div className="min-h-screen bg-mist">
      <PublicHeader showTry={state.status !== 'missing'} />

      <main className="mx-auto max-w-6xl px-5 pt-10 pb-20 sm:px-8 sm:pt-14">
        {state.status === 'loading' && <PublicProfileSkeleton />}
        {state.status === 'error' && <ErrorNotice message={state.message} />}
        {state.status === 'missing' && <NotFound handle={handle} />}

        {profile && (
          <>
            {preview && (
              <p role="status" className="mb-6 flex flex-wrap items-center gap-3 border-2 border-ink bg-secondary-soft px-4 py-3 text-sm text-ink">
                <span className="font-label text-[10px] text-secondary">{t('landing.profile.preview')}</span>
                {t('landing.profile.previewBody')}
                <Link to="/profile" className="font-semibold text-primary underline underline-offset-4">
                  {t('landing.profile.makePublic')}
                </Link>
              </p>
            )}
            <p className="font-label text-xs text-secondary">
              {t('landing.profile.kicker')}
              <span className="motion-safe:animate-caret">_</span>
            </p>
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <ProfileCard profile={profile} large headingLevel={1} />
              <div>
                <MessageButton handle={profile.handle} className="mb-5" />
                <Stats profile={profile} />
                {profile.memberSince && (
                  <p className="mt-4 font-label text-[10px] text-muted">
                    {t('landing.profile.memberSince', { date: format.date(profile.memberSince, { month: 'long', year: 'numeric' }) })}
                  </p>
                )}
              </div>
            </div>

            {profile.activity && <ActivityGraph activity={profile.activity} today={localDay()} className="mt-14" />}

            <PublicNotes handle={profile.handle} notes={notes} />

            <section aria-labelledby="badges-title" className="mt-14">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id="badges-title" className="font-pixel text-2xl font-bold text-ink">
                  {t('landing.profile.badges')}
                </h2>
                <p className="font-label text-xs text-muted">
                  {t('landing.profile.badgesEarned', { earned: earned.length, total: BADGES.length })}
                </p>
              </div>
              {earned.length ? (
                <ul aria-label={t('landing.profile.badgesList')} className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {earned.map((badge, index) => (
                    <li key={badge.id} className="flex flex-col items-center border-2 border-ink bg-white p-4 text-center shadow-pixel-ink">
                      <span className="grid size-16 place-items-center border-2 border-ink bg-primary-soft">
                        <BadgeIcon id={badge.id} accent={index % 2 ? 'secondary' : 'primary'} className="size-11" />
                      </span>
                      <strong className="mt-3 font-pixel text-lg leading-tight text-ink">{badgeName(t, badge.id)}</strong>
                      <span className="mt-1 text-xs text-muted">{badgeHow(t, badge.id)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted">{t('landing.profile.badgesNone')}</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
