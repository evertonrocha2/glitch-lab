import { Link } from 'react-router'
import { LANGUAGES, labelOf, ROLES } from '../../../shared/profile.js'
import PixelAvatar from '../pixel/PixelAvatar.jsx'
import PixelCard from '../pixel/PixelCard.jsx'

const MAX_LANGUAGES = 4

// A small card for one detective (search results, a note's author). The name links to the
// public profile, and that link stretches over the whole card so anywhere on it opens the profile.
export default function PersonCard({ person, headingLevel = 2, className = '' }) {
  const Heading = `h${headingLevel}`
  const facts = [person.university, person.work, person.location].filter(Boolean)
  const languages = person.languages ?? []
  return (
    <PixelCard tone="secondary" className={`relative flex h-full flex-col p-4 transition-transform focus-within:-translate-y-0.5 hover:-translate-y-0.5 ${className}`}>
      <div className="flex items-center gap-3">
        <PixelAvatar seed={person.avatar.seed} color={person.avatar.color} className="size-12" />
        <div className="min-w-0">
          <Heading className="font-pixel text-xl font-bold leading-tight text-ink">
            <Link to={`/u/${person.handle}`} className="break-words after:absolute after:inset-0 hover:text-primary focus-visible:outline-none">
              {person.displayName}
            </Link>
          </Heading>
          <p className="break-all font-label text-[10px] text-secondary">@{person.handle}</p>
        </div>
      </div>
      {(person.role || person.headline) && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
          {person.role && (
            <span className="border-2 border-ink bg-secondary-soft px-1.5 py-0.5 font-label text-[10px] text-secondary">{labelOf(ROLES, person.role)}</span>
          )}
          {person.headline && <span className="break-words font-semibold text-ink">{person.headline}</span>}
        </p>
      )}
      {facts.length > 0 && <p className="mt-2 break-words text-sm text-muted">{facts.join(' · ')}</p>}
      {languages.length > 0 && (
        <ul aria-label="Languages" className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {languages.slice(0, MAX_LANGUAGES).map((id) => (
            <li key={id} className="border border-ink bg-white px-1.5 py-0.5 font-mono text-xs text-ink">
              {labelOf(LANGUAGES, id)}
            </li>
          ))}
          {languages.length > MAX_LANGUAGES && <li className="px-1 py-0.5 font-mono text-xs text-muted">+{languages.length - MAX_LANGUAGES}</li>}
        </ul>
      )}
    </PixelCard>
  )
}
