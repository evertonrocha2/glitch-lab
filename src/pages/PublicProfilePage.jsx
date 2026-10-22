import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { BADGES } from '../../shared/badges.js'
import ErrorNotice from '../components/ErrorNotice.jsx'
import BadgeIcon from '../components/pixel/BadgeIcon.jsx'
import PixelBug from '../components/pixel/PixelBug.jsx'
import PixelButton from '../components/pixel/PixelButton.jsx'
import PixelCard from '../components/pixel/PixelCard.jsx'
import PixelLogo from '../components/pixel/PixelLogo.jsx'
import ProfileCard from '../components/profile/ProfileCard.jsx'
import { getPublicProfile } from '../lib/api.js'
import { formatDuration, localDay } from '../lib/day.js'

const memberSince = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

function TryLink() {
  return (
    <PixelButton as={Link} to="/" className="px-3 py-2">
      Try Glitch Detective
    </PixelButton>
  )
}

function Stats({ profile }) {
  const items = [
    { label: 'Streak', value: `${profile.streak}d`, note: 'days in a row', tone: 'text-primary' },
    { label: 'Studied', value: formatDuration(profile.totalSeconds), note: 'in total', tone: 'text-secondary' },
    { label: 'Cases', value: profile.counts.cases, note: 'investigated', tone: 'text-ink' },
    { label: 'Solved', value: profile.counts.solved, note: 'cases closed', tone: 'text-primary' },
    { label: 'Gym', value: profile.counts.passedChallenges, note: 'challenges passed', tone: 'text-secondary' },
  ]
  return (
    <ul aria-label="Stats" className="grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink sm:grid-cols-5 lg:grid-cols-1">
      {items.map((item) => (
        <li key={item.label} className="bg-white px-4 py-3 last:col-span-2 sm:last:col-span-1">
          <span className="font-label text-xs text-muted">{item.label}</span>
          <strong className={`mt-1 block pt-1 font-label text-2xl leading-none ${item.tone}`}>{item.value}</strong>
          <span className="text-xs text-muted">{item.note}</span>
        </li>
      ))}
    </ul>
  )
}

function NotFound({ handle }) {
  return (
    <PixelCard tone="muted" className="mx-auto max-w-lg p-8 text-center">
      <PixelBug className="mx-auto h-12 w-auto" />
      <h1 className="mt-6 font-pixel text-3xl font-bold text-ink">No detective here</h1>
      <p className="mt-3 break-words text-muted">
        There is no public profile for <span className="font-label text-xs text-ink">@{handle}</span>. It may be private, or the
        link may have a typo.
      </p>
      <div className="mt-6">
        <TryLink />
      </div>
    </PixelCard>
  )
}

// A detective's public file: anyone can open it, signed in or not.
export default function PublicProfilePage() {
  const { handle } = useParams()
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let live = true
    setState({ status: 'loading' })
    getPublicProfile(handle, localDay())
      .then((profile) => live && setState(profile ? { status: 'ready', profile } : { status: 'missing' }))
      .catch((err) => live && setState({ status: 'error', message: err.message }))
    return () => {
      live = false
    }
  }, [handle])

  const { profile } = state
  const earned = profile ? BADGES.filter((badge) => profile.badges.includes(badge.id)) : []

  return (
    <div className="min-h-screen bg-mist">
      <header className="border-b-2 border-ink bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2 whitespace-nowrap font-pixel text-lg font-bold text-ink sm:gap-2.5 sm:text-xl">
            <PixelLogo className="size-6 sm:size-7" />
            <span>Glitch Detective</span>
          </Link>
          {state.status !== 'missing' && <TryLink />}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pt-10 pb-20 sm:px-8 sm:pt-14">
        {state.status === 'loading' && (
          <p role="status" className="font-label text-xs text-muted">
            Opening the file...
          </p>
        )}
        {state.status === 'error' && <ErrorNotice message={state.message} />}
        {state.status === 'missing' && <NotFound handle={handle} />}

        {profile && (
          <>
            <p className="font-label text-xs text-secondary">
              &gt; detective file<span className="motion-safe:animate-caret">_</span>
            </p>
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <ProfileCard profile={profile} large headingLevel={1} />
              <div>
                <Stats profile={profile} />
                {profile.memberSince && (
                  <p className="mt-4 font-label text-[10px] text-muted">Member since {memberSince(profile.memberSince)}</p>
                )}
              </div>
            </div>

            <section aria-labelledby="badges-title" className="mt-14">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id="badges-title" className="font-pixel text-2xl font-bold text-ink">
                  Badges
                </h2>
                <p className="font-label text-xs text-muted">
                  {earned.length}/{BADGES.length} earned
                </p>
              </div>
              {earned.length ? (
                <ul aria-label="Earned badges" className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {earned.map((badge, index) => (
                    <li key={badge.id} className="flex flex-col items-center border-2 border-ink bg-white p-4 text-center shadow-pixel-ink">
                      <span className="grid size-16 place-items-center border-2 border-ink bg-primary-soft">
                        <BadgeIcon id={badge.id} accent={index % 2 ? 'secondary' : 'primary'} className="size-11" />
                      </span>
                      <strong className="mt-3 font-pixel text-lg leading-tight text-ink">{badge.name}</strong>
                      <span className="mt-1 text-xs text-muted">{badge.how}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted">No badges yet. Every detective starts somewhere.</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
