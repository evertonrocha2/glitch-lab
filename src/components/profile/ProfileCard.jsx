import { badgeById } from '../../../shared/badges.js'
import { LANGUAGES, LINKS, labelOf, OPEN_TO, ROLES } from '../../../shared/profile.js'
import BadgeIcon from '../pixel/BadgeIcon.jsx'
import PixelAvatar from '../pixel/PixelAvatar.jsx'
import PixelCard from '../pixel/PixelCard.jsx'

const SEGMENTS = 16

function XpBar({ xp, levelXp, nextLevelXp }) {
  const share = nextLevelXp ? (xp - levelXp) / (nextLevelXp - levelXp) : 1
  const filled = Math.round(Math.min(Math.max(share, 0), 1) * SEGMENTS)
  return (
    <div
      role="progressbar"
      aria-label="Experience toward the next level"
      aria-valuemin={levelXp}
      aria-valuemax={nextLevelXp ?? xp}
      aria-valuenow={xp}
      className="flex gap-[3px] border-2 border-ink bg-white p-[3px]"
    >
      {Array.from({ length: SEGMENTS }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative segments
        <span key={index} className={`h-3 flex-1 ${index < filled ? (index % 2 ? 'bg-secondary' : 'bg-primary') : 'bg-mist'}`} />
      ))}
    </div>
  )
}

// "Software Engineering at Infnet", or whichever half was filled in.
const studies = ({ course, university }) => (course && university ? `${course} at ${university}` : course || university)

// Role, headline, school, job, place, languages, what they're open to and their links.
// Every field is optional; a profile that filled in nothing shows nothing here.
function AboutDetails({ profile, large }) {
  const facts = [
    ['Studies', studies(profile)],
    ['Works', profile.work],
    ['Based in', profile.location],
  ].filter(([, value]) => value)
  const languages = profile.languages ?? []
  const openTo = profile.openTo ?? []
  const links = LINKS.filter((link) => profile.links?.[link.id])
  if (!facts.length && !languages.length && !openTo.length && !links.length) return null
  return (
    <div className="mt-5 space-y-4 border-t-2 border-dashed border-line pt-4">
      {facts.length > 0 && (
        <dl className={`grid gap-x-4 gap-y-1.5 ${large ? 'text-base' : 'text-sm'} grid-cols-[auto_minmax(0,1fr)]`}>
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="pt-0.5 font-label text-[10px] text-muted">{label}</dt>
              <dd className="break-words text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {languages.length > 0 && (
        <ul aria-label="Languages" className="flex flex-wrap gap-1.5">
          {languages.map((id) => (
            <li key={id} className="border-2 border-ink bg-white px-1.5 py-0.5 font-mono text-xs text-ink">
              {labelOf(LANGUAGES, id)}
            </li>
          ))}
        </ul>
      )}
      {openTo.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-label text-[10px] text-muted">Open to</span>
          <ul aria-label="Open to" className="contents">
            {openTo.map((id) => (
              <li key={id} className="bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary">
                {labelOf(OPEN_TO, id)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {links.length > 0 && (
        <ul aria-label="Links" className="flex flex-wrap gap-2">
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={profile.links[link.id]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border-2 border-ink bg-white px-2.5 py-1.5 font-label text-[10px] text-ink shadow-pixel-ink transition-colors hover:bg-secondary hover:text-white"
              >
                {link.label}
                <span aria-hidden="true">↗</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// The card a visitor sees: avatar, name, handle, bio, about-you, level and featured badges.
// "large" is the public page; the default is the editor's live preview.
export default function ProfileCard({ profile, large = false, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`
  const featured = profile.featuredBadges.map(badgeById).filter(Boolean)
  return (
    <PixelCard className={`relative overflow-hidden ${large ? 'p-6 sm:p-8' : 'p-5'}`}>
      <div aria-hidden="true" className="dither-secondary absolute inset-y-0 right-0 w-1/2 opacity-20" />
      <div className="relative">
        <div className="flex items-center gap-4 sm:gap-5">
          <PixelAvatar seed={profile.avatar.seed} color={profile.avatar.color} className={large ? 'size-20 sm:size-28' : 'size-16'} />
          <div className="min-w-0">
            <Heading className={`break-words font-pixel font-bold leading-tight text-ink ${large ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>
              {profile.displayName}
            </Heading>
            {profile.handle ? (
              <p className="mt-1 break-all font-label text-xs text-secondary">@{profile.handle}</p>
            ) : (
              <p className="mt-1 font-label text-[10px] text-muted">No handle yet</p>
            )}
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink">
              <span className="bg-primary px-1.5 py-0.5 font-label text-[10px] leading-none text-white">Lv {profile.level}</span>
              <span className="font-label text-xs">{profile.title}</span>
            </p>
          </div>
        </div>

        {(profile.role || profile.headline) && (
          <p className="mt-4 flex flex-wrap items-center gap-2">
            {profile.role && (
              <span className="border-2 border-ink bg-secondary-soft px-1.5 py-0.5 font-label text-[10px] text-secondary">
                {labelOf(ROLES, profile.role)}
              </span>
            )}
            {profile.headline && <span className={`break-words font-semibold text-ink ${large ? 'text-lg' : ''}`}>{profile.headline}</span>}
          </p>
        )}

        {profile.bio && <p className={`mt-5 whitespace-pre-line break-words text-ink ${large ? 'text-lg' : ''}`}>{profile.bio}</p>}

        <AboutDetails profile={profile} large={large} />

        <div className="mt-5">
          <XpBar xp={profile.xp} levelXp={profile.levelXp} nextLevelXp={profile.nextLevelXp} />
          <p className="mt-1.5 font-label text-[10px] text-muted">
            {profile.xp} XP{profile.nextLevelXp ? ` · ${profile.nextLevelXp - profile.xp} to level ${profile.level + 1}` : ' · top level'}
          </p>
        </div>

        <div className="mt-5 border-t-2 border-dashed border-line pt-4">
          <p className="font-label text-[10px] text-muted">Featured badges</p>
          {featured.length ? (
            <ul aria-label="Featured badges" className="mt-3 grid grid-cols-3 gap-3">
              {featured.map((badge, index) => (
                <li key={badge.id} className="flex min-w-0 flex-col items-center text-center">
                  <span className={`grid place-items-center border-2 border-ink bg-primary-soft shadow-pixel-ink ${large ? 'size-20 sm:size-24' : 'size-14'}`}>
                    <BadgeIcon id={badge.id} accent={index % 2 ? 'secondary' : 'primary'} className={large ? 'size-14 sm:size-16' : 'size-9'} />
                  </span>
                  <span className={`mt-2 font-pixel leading-tight text-ink ${large ? 'text-base sm:text-lg' : 'text-sm'}`}>{badge.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No badges picked yet.</p>
          )}
        </div>
      </div>
    </PixelCard>
  )
}
