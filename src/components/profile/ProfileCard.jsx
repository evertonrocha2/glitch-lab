import { badgeById } from '../../../shared/badges.js'
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

// The card a visitor sees: avatar, name, handle, bio, level and featured badges.
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

        {profile.bio && <p className={`mt-5 whitespace-pre-line break-words text-ink ${large ? 'text-lg' : ''}`}>{profile.bio}</p>}

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
