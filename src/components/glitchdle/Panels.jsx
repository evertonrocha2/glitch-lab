import { DISTRIBUTION_SIZE, MODE_NAMES, MODES } from '../../../shared/riddle/game.js'
import { formatCountdown } from '../../lib/daily.js'
import PixelButton from '../pixel/PixelButton.jsx'
import PixelCard from '../pixel/PixelCard.jsx'
import { Check } from './Boards.jsx'

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

const guessesText = (count) => `${count} ${count === 1 ? 'guess' : 'guesses'}`

// The end of a mode: solved or out of guesses, the answer, sharing and the wait for tomorrow.
export function ResultCard({ state, justWon, msLeft, onShare, copied }) {
  return (
    <PixelCard tone={state.solved ? 'primary' : 'muted'} className="relative overflow-visible p-5">
      {justWon && <WinBurst />}
      <div role="status" className="relative">
        <p className="font-label text-xs text-secondary">{state.solved ? 'Case cracked' : 'Out of guesses'}</p>
        <p className="mt-1 font-pixel text-2xl font-bold text-ink">
          {state.solved ? `Solved in ${guessesText(state.guessCount)}!` : 'So close.'} It was <span className="text-primary">{state.answer.name}</span>.
        </p>
      </div>
      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-label text-xs text-muted">
          Next Glitchdle in <span className="text-ink tabular-nums">{formatCountdown(msLeft)}</span>
        </p>
        <PixelButton onClick={onShare} variant="secondary">
          {copied ? 'Copied!' : 'Share result'}
        </PixelButton>
      </div>
    </PixelCard>
  )
}

// My numbers: games, perfect days and streaks, and how many guesses my solves took in this mode.
export function StatsPanel({ stats, mode, todayGuesses }) {
  const bars = stats.distribution[mode]
  const most = Math.max(1, ...bars)
  return (
    <PixelCard tone="secondary" className="p-5">
      <h2 className="font-pixel text-xl font-bold text-ink">Your stats</h2>
      <ul aria-label="Your Glitchdle numbers" className="mt-4 grid grid-cols-4 gap-[2px] border-2 border-ink bg-ink">
        {[
          ['Played', stats.played],
          ['Perfect', stats.perfectDays],
          ['Streak', stats.streak],
          ['Best', stats.longestStreak],
        ].map(([name, value]) => (
          <li key={name} className="min-w-0 bg-white px-2 py-2 text-center">
            <strong className="block font-label text-xl leading-none text-ink tabular-nums">{value}</strong>
            <span className="mt-1 block font-label text-[10px] text-muted">{name}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">A perfect day has all three modes solved. The streak counts perfect days in a row.</p>
      <h3 className="mt-5 font-label text-xs text-ink">{MODE_NAMES[mode]} guess distribution</h3>
      {bars.every((count) => count === 0) ? (
        <p className="mt-2 border-2 border-dashed border-line px-3 py-3 text-xs text-muted">No {MODE_NAMES[mode]} solves yet. Your first one starts the chart.</p>
      ) : (
        <ol aria-label={`${MODE_NAMES[mode]} guess distribution`} className="mt-2 space-y-1">
          {bars.map((count, index) => {
            const name = index === DISTRIBUTION_SIZE - 1 ? `${DISTRIBUTION_SIZE}+` : String(index + 1)
            const today = todayGuesses !== null && Math.min(todayGuesses, DISTRIBUTION_SIZE) - 1 === index
            return (
              <li key={name} className="flex items-center gap-2 text-xs">
                <span className="w-6 shrink-0 text-right font-mono text-muted">{name}</span>
                <span className="flex-1">
                  <span
                    className={`flex h-5 min-w-6 items-center justify-end px-1.5 font-label text-[10px] ${today ? 'bg-primary text-white' : count ? 'bg-secondary text-white' : 'bg-mist text-muted'}`}
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

// Today's numbers for every mode, demo accounts left out.
export function CommunityPanel({ community, modes }) {
  return (
    <PixelCard tone="primary" className="p-5">
      <h2 className="font-pixel text-xl font-bold text-ink">Today's detectives</h2>
      <table className="mt-4 w-full border-2 border-ink text-sm">
        <thead className="bg-mist font-label text-[10px] text-muted">
          <tr>
            <th scope="col" className="px-2 py-1.5 text-left font-normal">
              Mode
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-normal">
              Solved
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-normal">
              Avg guesses
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-normal">
              You
            </th>
          </tr>
        </thead>
        <tbody>
          {MODES.map((mode) => {
            const numbers = community[mode]
            const mine = modes[mode]
            return (
              <tr key={mode} className="border-t-2 border-line">
                <th scope="row" className="px-2 py-2 text-left font-semibold text-ink">
                  {MODE_NAMES[mode]}
                </th>
                <td className="px-2 py-2 text-right tabular-nums text-ink">
                  {numbers.solved}/{numbers.players}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-ink">{numbers.averageGuesses ?? '-'}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {mine.solved ? (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <Check /> {mine.guessCount}
                    </span>
                  ) : mine.over ? (
                    <span className="text-muted">X</span>
                  ) : (
                    <span className="text-muted">{mine.guessCount ? `${mine.guessCount} ${mine.guessCount === 1 ? 'try' : 'tries'}` : '-'}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">Solved out of everyone who guessed today. Demo accounts don't count.</p>
    </PixelCard>
  )
}
