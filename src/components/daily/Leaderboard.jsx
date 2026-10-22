import { Link } from 'react-router'
import { formatSolveTime } from '../../lib/daily.js'
import PixelAvatar from '../pixel/PixelAvatar.jsx'

const attemptsText = (count) => `${count} attempt${count === 1 ? '' : 's'}`

function Avatar({ entry }) {
  if (entry.avatar) return <PixelAvatar seed={entry.avatar.seed} color={entry.avatar.color} className="size-8" />
  // A private profile: no face, just a question mark.
  return (
    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center border-2 border-ink bg-mist font-pixel text-sm text-muted">
      ?
    </span>
  )
}

// Top solvers of the global challenge: fastest from start to pass, then fewer attempts.
// Names and pictures only for public profiles; the API already blanks out everyone else.
export default function Leaderboard({ entries, you }) {
  const meOutside = you && !entries.some((entry) => entry.isYou)
  return (
    <div>
      <h3 className="font-label text-xs text-ink">Leaderboard</h3>
      {entries.length === 0 ? (
        <p className="mt-3 border-2 border-dashed border-muted/60 bg-white p-4 text-sm text-muted">Nobody has solved it yet. Be the first.</p>
      ) : (
        <ol aria-label="Leaderboard" className="mt-3 border-2 border-ink bg-white shadow-pixel-ink">
          {entries.map((entry) => (
            <li
              key={entry.rank}
              className={`flex items-center gap-3 border-b-2 border-ink px-3 py-2.5 last:border-b-0 ${entry.isYou ? 'bg-secondary-soft' : ''}`}
            >
              <span className={`w-7 shrink-0 font-label text-sm ${entry.rank === 1 ? 'text-primary' : 'text-ink'}`}>#{entry.rank}</span>
              <Avatar entry={entry} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">
                  {entry.handle ? (
                    <Link to={`/u/${entry.handle}`} className="hover:text-primary hover:underline">
                      {entry.name}
                    </Link>
                  ) : (
                    entry.name
                  )}
                </span>
                {(entry.firstSolver || entry.isYou) && (
                  <span className="mt-0.5 flex flex-wrap gap-1.5">
                    {entry.firstSolver && <span className="bg-primary px-1 py-0.5 font-label text-[9px] leading-none text-white">First solver</span>}
                    {entry.isYou && <span className="bg-secondary px-1 py-0.5 font-label text-[9px] leading-none text-white">You</span>}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <strong className="block font-mono text-sm text-ink">{formatSolveTime(entry.seconds)}</strong>
                <span className="text-xs text-muted">{attemptsText(entry.attempts)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {meOutside && (
        <p className="mt-3 text-sm text-ink">
          You are #{you.rank} with {formatSolveTime(you.seconds)}.
        </p>
      )}
    </div>
  )
}
