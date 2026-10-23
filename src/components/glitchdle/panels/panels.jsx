import { DISTRIBUTION_SIZE } from '../../../../shared/riddle/game.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../../lib/i18n/labels.js'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../ui/pixel-card/pixel-card.jsx'
import { Check } from '../boards/boards.jsx'
import Countdown from '../countdown/countdown.jsx'

// Pixels thrown out from the middle on a win. Purely decorative, and gone with reduced motion.
const BURST = Array.from({ length: 18 }, (_, index) => {
  const angle = (index / 18) * Math.PI * 2
  const distance = 70 + (index % 3) * 30
  return {
    x: `${Math.round(Math.cos(angle) * distance)}px`,
    y: `${Math.round(Math.sin(angle) * distance)}px`,
    color: ['bg-primary', 'bg-secondary', 'bg-ink'][index % 3],
    size: index % 2 ? 'size-2' : 'size-3',
  }
})

export function WinBurst() {
  return (
    <span aria-hidden="true" data-testid="win-burst" className="pointer-events-none absolute top-1/2 left-1/2 motion-reduce:hidden">
      {BURST.map((pixel, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed decoration
          key={index}
          style={{ '--burst-x': pixel.x, '--burst-y': pixel.y, animationDelay: `${(index % 3) * 60}ms` }}
          className={`absolute ${pixel.size} ${pixel.color} motion-safe:animate-burst`}
        />
      ))}
    </span>
  )
}

// The end of a board: solved or out of guesses, the answer, sharing and the wait for tomorrow.
export function ResultCard({ state, justWon, resetAt, onShare, copied }) {
  const t = useT()
  return (
    <PixelCard tone={state.solved ? 'primary' : 'muted'} className="relative overflow-visible p-5">
      {justWon && <WinBurst />}
      <div role="status" className="relative">
        <p className="font-label text-xs text-secondary">{state.solved ? t('app.glitchdle.cracked') : t('app.glitchdle.outOfGuesses')}</p>
        <p className="mt-1 font-pixel text-2xl font-bold text-ink">
          {state.solved ? t('app.glitchdle.solvedIn', { guesses: t('app.glitchdle.guesses', { count: state.guessCount }) }) : t('app.glitchdle.soClose')}{' '}
          {t('app.glitchdle.itWas')} <span className="text-primary">{state.answer.name}</span>.
        </p>
      </div>
      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-label text-xs text-muted">
          {t('app.glitchdle.nextGlitchdle')} <Countdown resetAt={resetAt} className="text-ink tabular-nums" />
        </p>
        <span className="flex items-center gap-2">
          {/* A short confirmation next to the button, read out when it appears. */}
          <span role="status" className="font-label text-xs text-primary">
            {copied ? t('app.glitchdle.shareCopied') : ''}
          </span>
          <PixelButton onClick={onShare} variant="secondary">
            {t('app.glitchdle.share')}
          </PixelButton>
        </span>
      </div>
    </PixelCard>
  )
}

// My numbers: games, perfect days and streaks. Two by two when narrow, four across in between.
export function StatsPanel({ stats }) {
  const t = useT()
  return (
    <PixelCard tone="secondary" className="p-4">
      <h2 className="font-pixel text-lg font-bold text-ink">{t('app.glitchdle.stats')}</h2>
      <ul aria-label={t('app.glitchdle.numbers')} className="mt-3 grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink sm:grid-cols-4 lg:grid-cols-2">
        {[
          [t('app.glitchdle.played'), stats.played],
          [t('app.glitchdle.perfect'), stats.perfectDays],
          [t('app.glitchdle.streak'), stats.streak],
          [t('app.glitchdle.best'), stats.longestStreak],
        ].map(([name, value]) => (
          <li key={name} className="min-w-0 bg-white px-2 py-2 text-center">
            <strong className="block font-pixel font-bold text-xl leading-none text-ink tabular-nums">{value}</strong>
            <span className="mt-1 block truncate font-label text-[10px] text-muted">{name}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">{t('app.glitchdle.statsHint')}</p>
    </PixelCard>
  )
}

// How many guesses my solves took in this mode, today's solve in purple.
export function DistributionPanel({ stats, mode, todayGuesses }) {
  const bars = stats.distribution[mode]
  const most = Math.max(1, ...bars)
  const t = useT()
  const modeName = useLabels().glitchdleMode(mode)
  const title = t('app.glitchdle.distribution', { mode: modeName })
  return (
    <PixelCard tone="muted" className="p-4">
      <h2 className="font-pixel text-lg font-bold leading-tight text-ink">{title}</h2>
      {bars.every((count) => count === 0) ? (
        <p className="mt-3 border-2 border-dashed border-line px-3 py-3 text-xs text-muted">{t('app.glitchdle.noSolves', { mode: modeName })}</p>
      ) : (
        <ol aria-label={title} className="mt-3 space-y-1">
          {bars.map((count, index) => {
            const name = index === DISTRIBUTION_SIZE - 1 ? `${DISTRIBUTION_SIZE}+` : String(index + 1)
            const today = todayGuesses !== null && Math.min(todayGuesses, DISTRIBUTION_SIZE) - 1 === index
            return (
              <li key={name} className="flex items-center gap-2 text-xs">
                <span className="w-6 shrink-0 text-right font-label text-[10px] text-muted">{name}</span>
                <span className="flex-1">
                  <span
                    className={`flex h-4 min-w-6 items-center justify-end px-1.5 font-label text-[10px] ${today ? 'bg-primary text-white' : count ? 'bg-secondary text-white' : 'bg-mist text-muted'}`}
                    style={{ width: `${Math.max(8, (count / most) * 100)}%` }}
                  >
                    {count}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </PixelCard>
  )
}

// Today's numbers for every board, demo accounts left out.
export function CommunityPanel({ community, modes }) {
  const t = useT()
  const labels = useLabels()
  return (
    <PixelCard tone="primary" className="p-4">
      <h2 className="font-pixel text-lg font-bold text-ink">{t('app.glitchdle.community')}</h2>
      <table className="mt-3 w-full border-2 border-ink text-xs">
        <thead className="bg-mist font-label text-[10px] text-muted">
          <tr>
            <th scope="col" className="px-1.5 py-1.5 text-left font-normal">
              {t('app.glitchdle.mode')}
            </th>
            <th scope="col" className="px-1.5 py-1.5 text-right font-normal">
              {t('app.glitchdle.solvedCol')}
            </th>
            <th scope="col" title={t('app.glitchdle.avgGuesses')} className="px-1.5 py-1.5 text-right font-normal">
              <span aria-hidden="true">{t('app.glitchdle.avgShort')}</span>
              <span className="sr-only">{t('app.glitchdle.avgGuesses')}</span>
            </th>
            <th scope="col" className="px-1.5 py-1.5 text-right font-normal">
              {t('app.glitchdle.you')}
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(modes).map((mode) => {
            const numbers = community[mode]
            const mine = modes[mode]
            return (
              <tr key={mode} className="border-t-2 border-line">
                <th scope="row" className="px-1.5 py-1.5 text-left font-semibold text-ink">
                  {labels.glitchdleMode(mode)}
                </th>
                <td className="px-1.5 py-1.5 text-right tabular-nums text-ink">
                  {numbers.solved}/{numbers.players}
                </td>
                <td className="px-1.5 py-1.5 text-right tabular-nums text-ink">{numbers.averageGuesses ?? '-'}</td>
                <td className="px-1.5 py-1.5 text-right whitespace-nowrap tabular-nums">
                  {mine.solved ? (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <Check /> {mine.guessCount}
                    </span>
                  ) : mine.over ? (
                    <span className="text-muted">X</span>
                  ) : (
                    <span className="text-muted">{mine.guessCount ? t('app.glitchdle.tries', { count: mine.guessCount }) : '-'}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">{t('app.glitchdle.communityHint')}</p>
    </PixelCard>
  )
}
