import { forwardRef } from 'react'
import { playerName } from '../../lib/duel.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../lib/i18n/labels.js'
import { WinBurst } from '../glitchdle/Panels.jsx'
import PixelButton from '../pixel/PixelButton.jsx'
import PixelCard from '../pixel/PixelCard.jsx'
import { PlayerFace, RoundLine, seatsInOrder } from './Play.jsx'

function headline(t, duel) {
  const { result, you, players } = duel
  if (you === null) return result.winner === null ? t('duel.result.draw') : t('duel.result.spectatorWin', { name: playerName(t, players[result.winner]) })
  if (result.forfeit === you) return t('duel.result.youLeft')
  if (result.forfeit !== null) return t('duel.result.opponentLeft')
  if (result.winner === null) return t('duel.result.draw')
  return result.winner === you ? t('duel.result.win') : t('duel.result.loss')
}

// The end of a duel: who won, the scores, the rating change, every round, and what's next.
export const ResultPanel = forwardRef(function ResultPanel({ duel, onRematch, onPlayBot, onShare, copied, busy }, headingRef) {
  const t = useT()
  const labels = useLabels()
  const { result } = duel
  const won = duel.you !== null && result.winner === duel.you
  const seats = seatsInOrder(duel)
  const rematchFromThem = duel.rematchId && duel.you !== null
  return (
    <div className="space-y-6">
      <PixelCard tone={won ? 'primary' : 'muted'} className="relative overflow-visible p-5 sm:p-6">
        {won && <WinBurst />}
        <div className="relative">
          <h2 ref={headingRef} tabIndex={-1} className="font-pixel text-3xl font-bold text-ink outline-none sm:text-4xl">
            {headline(t, duel)}
          </h2>
          <ul className="mt-5 grid grid-cols-2 gap-3">
            {seats.map(({ player, index }) => (
              <li key={index} className="min-w-0 border-2 border-ink bg-white p-3">
                <span className="flex min-w-0 items-center gap-2">
                  <PlayerFace player={player} className="size-7" />
                  <span className="truncate font-label text-xs text-ink">{playerName(t, player)}</span>
                </span>
                <strong className="mt-2 block font-pixel text-3xl font-bold leading-none text-ink tabular-nums">{result.scores[index]}</strong>
              </li>
            ))}
          </ul>
          {duel.you !== null && (
            <p className="mt-4 font-label text-xs text-muted">
              {result.rated && result.rating ? (
                <>
                  {t('duel.result.rating', { before: result.rating.before, after: result.rating.after })}{' '}
                  <span className={result.rating.after >= result.rating.before ? 'text-secondary' : 'text-primary'}>
                    ({result.rating.after >= result.rating.before ? '+' : ''}
                    {result.rating.after - result.rating.before})
                  </span>
                </>
              ) : (
                t('duel.result.practice')
              )}
            </p>
          )}
        </div>
      </PixelCard>

      <div className="flex flex-wrap gap-3">
        {duel.you !== null && duel.kind !== 'bot' && (
          <PixelButton onClick={onRematch} disabled={busy}>
            {rematchFromThem ? t('duel.rematchJoin') : t('duel.rematch')}
          </PixelButton>
        )}
        {duel.you !== null && duel.kind === 'bot' && (
          <PixelButton onClick={onPlayBot} disabled={busy}>
            {t('duel.playAgain')}
          </PixelButton>
        )}
        <PixelButton variant="secondary" onClick={onShare}>
          {copied ? t('duel.wait.copied') : t('duel.share')}
        </PixelButton>
      </div>

      <section aria-labelledby="duel-breakdown">
        <h3 id="duel-breakdown" className="font-pixel text-xl font-bold text-ink">
          {t('duel.result.breakdown')}
        </h3>
        <ol className="mt-3 border-2 border-ink bg-white shadow-pixel-ink">
          {duel.rounds.map((round) => (
            <li key={round.index} className="border-b-2 border-ink px-3 py-3 last:border-b-0 sm:px-4">
              <p className="flex flex-wrap items-baseline gap-x-2 font-label text-xs text-secondary">
                <span>{t('duel.round', { n: round.index + 1, total: duel.roundCount })}</span>
                <span className="text-muted">·</span>
                <span className="text-muted">{t(`duel.typeShort.${round.type}`)}</span>
                <span className="text-muted">·</span>
                <span className="min-w-0 break-words text-ink">{round.type === 'bug' ? labels.concept(round.answer.id) : round.answer.name}</span>
              </p>
              <ul className="mt-2 space-y-1">
                {seats.map(({ player, index }) => (
                  <li key={index} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="w-24 shrink-0 truncate text-xs text-muted sm:w-32">{playerName(t, player)}</span>
                    <RoundLine result={round.players[index]} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
})
