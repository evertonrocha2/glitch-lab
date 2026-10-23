import { Link } from 'react-router'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import PixelAvatar from '../pixel/PixelAvatar.jsx'

function Avatar({ entry }) {
  if (entry.avatar) return <PixelAvatar seed={entry.avatar.seed} color={entry.avatar.color} className="size-8" />
  // A private profile: no face, just a question mark.
  return (
    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center border-2 border-ink bg-mist font-pixel text-sm text-muted">
      ?
    </span>
  )
}

// Today's top 10 finished runs: most points, then most lines, then the fastest. Demo accounts never
// rank, and only public profiles show a name (the API already blanks everyone else).
export default function HuntLeaderboard({ entries, you }) {
  const t = useT()
  const meOutside = you && !entries.some((entry) => entry.isYou)
  return (
    <section aria-labelledby="hunt-board-title">
      <h2 id="hunt-board-title" className="font-label text-xs text-ink">
        {t('hunt.board.title')}
      </h2>
      {entries.length === 0 ? (
        <p className="mt-3 border-2 border-dashed border-muted/60 bg-white p-4 text-sm text-muted">{t('hunt.board.empty')}</p>
      ) : (
        <ol aria-label={t('hunt.board.title')} className="mt-3 border-2 border-ink bg-white shadow-pixel-ink">
          {entries.map((entry) => (
            <li key={entry.rank} className={`flex items-center gap-3 border-b-2 border-ink px-3 py-2.5 last:border-b-0 ${entry.isYou ? 'bg-secondary-soft' : ''}`}>
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
                {entry.isYou && <span className="mt-0.5 inline-block bg-secondary px-1 py-0.5 font-label text-[10px] leading-none text-white">{t('hunt.board.you')}</span>}
              </span>
              <span className="shrink-0 text-right">
                <strong className="block font-pixel text-sm font-bold text-ink tabular-nums">{t('hunt.board.points', { count: entry.score })}</strong>
                <span className="text-xs text-muted">{t('hunt.board.lines', { count: entry.correct })}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {meOutside && <p className="mt-3 text-sm text-ink">{t('hunt.board.yourRank', { rank: you.rank, score: you.score })}</p>}
    </section>
  )
}
