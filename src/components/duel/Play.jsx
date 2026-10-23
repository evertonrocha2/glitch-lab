import { forwardRef } from 'react'
import { ROUND_MS } from '../../../shared/duel.js'
import { formatSeconds, playerName, secondsUntil } from '../../lib/duel.js'
import { useI18n, useT } from '../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../lib/i18n/labels.js'
import PixelAvatar from '../pixel/PixelAvatar.jsx'
import PixelCard from '../pixel/PixelCard.jsx'

// The Glitch Bot's face: a 9x9 robot, drawn like the badges.
const BOT_FACE = ['....#....', '...###...', '#########', '#ooooooo#', '#o##o##o#', '#ooooooo#', '#oo###oo#', '#ooooooo#', '#########']

export function PlayerFace({ player, className = 'size-8' }) {
  if (player.bot) {
    return (
      <svg viewBox="0 0 9 9" shapeRendering="crispEdges" aria-hidden="true" className={`shrink-0 ${className}`}>
        {BOT_FACE.flatMap((row, y) =>
          [...row].map((cell, x) =>
            cell === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" className={cell === '#' ? 'fill-ink' : 'fill-secondary-soft'} />,
          ),
        )}
      </svg>
    )
  }
  if (player.avatar) return <PixelAvatar seed={player.avatar.seed} color={player.avatar.color} className={className} />
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center border-2 border-ink bg-mist font-pixel text-sm text-muted ${className}`}>
      ?
    </span>
  )
}

// Me first (on the left), then the other player. Spectators see seat order.
export const seatsInOrder = (duel) => {
  const seats = duel.players.map((player, index) => ({ player, index }))
  return duel.you === 1 ? [seats[1], seats[0]] : seats
}

// Both players, their scores, and during a round whether each has answered or left the tab.
// presence: per seat, true / false when the realtime channel knows if that page is open, else null.
export function Scoreboard({ duel, presence = null }) {
  const t = useT()
  const current = duel.phase === 'round' ? duel.current : null
  return (
    <ul aria-label={t('duel.score')} className="grid grid-cols-2 gap-3 sm:gap-5">
      {seatsInOrder(duel).map(({ player, index }, place) => (
        <li key={index} className="min-w-0">
          <PixelCard tone={place === 0 ? 'primary' : 'secondary'} className="h-full p-3 sm:p-4">
            <div className="flex min-w-0 items-center gap-2">
              <PlayerFace player={player} className="size-7 sm:size-8" />
              <span className="truncate font-label text-xs text-ink sm:text-sm">{playerName(t, player)}</span>
              {typeof presence?.[index] === 'boolean' && (
                <span
                  data-testid="duel-presence"
                  title={presence[index] ? t('duel.presence.online') : t('duel.presence.offline')}
                  className={`size-2 shrink-0 border border-ink ${presence[index] ? 'bg-secondary' : 'bg-white'}`}
                >
                  <span className="sr-only">{presence[index] ? t('duel.presence.online') : t('duel.presence.offline')}</span>
                </span>
              )}
            </div>
            <strong className="mt-2 block font-pixel text-3xl font-bold leading-none text-ink tabular-nums sm:text-4xl">{duel.scores?.[index] ?? 0}</strong>
            {current && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 font-label text-[10px]">
                {current.answered[index] ? (
                  <span className="bg-secondary px-1 py-0.5 leading-none text-white">{t('duel.answered')}</span>
                ) : (
                  <span className="text-muted">{t('duel.thinking')}</span>
                )}
                {current.left[index] && <span className="bg-primary px-1 py-0.5 leading-none text-white">{t('duel.tab.flag')}</span>}
              </p>
            )}
          </PixelCard>
        </li>
      ))}
    </ul>
  )
}

// The 3-2-1 before the first round. The number is decorative; the label says what's coming.
export function Countdown({ seconds }) {
  const t = useT()
  return (
    <div className="grid place-items-center py-10 text-center sm:py-16">
      <p className="font-label text-sm text-secondary">{t('duel.countdown')}</p>
      <p
        key={seconds}
        aria-hidden="true"
        className="mt-4 font-pixel text-8xl font-bold leading-none text-primary tabular-nums motion-safe:animate-toast-in sm:text-9xl"
      >
        {seconds > 0 ? seconds : '...'}
      </p>
    </div>
  )
}

function Code({ children, wrap = false }) {
  return (
    <pre
      className={`mt-3 max-h-72 max-w-full overflow-auto border-2 border-ink bg-mist p-3 font-mono text-xs leading-relaxed text-ink sm:text-sm ${wrap ? 'break-words whitespace-pre-wrap' : 'whitespace-pre'}`}
    >
      <code>{children}</code>
    </pre>
  )
}

// What the round shows: an error, a snippet, or broken code with what it does wrong.
export function Prompt({ type, prompt }) {
  const t = useT()
  if (type === 'error') return <Code wrap>{prompt.text}</Code>
  if (type === 'snippet') return <Code>{prompt.code}</Code>
  return (
    <>
      <p className="mt-3 inline-block border-2 border-ink bg-white px-2 py-0.5 font-label text-[10px] text-ink">{prompt.language}</p>
      <Code>{prompt.code}</Code>
      <p className="mt-3 border-l-4 border-primary bg-primary-soft px-3 py-2 text-sm text-ink">
        <span className="font-label text-[10px] text-primary">{t('duel.symptom')}: </span>
        {prompt.symptom}
      </p>
    </>
  )
}

function useOptionLabel(type) {
  const labels = useLabels()
  return (option) => (type === 'bug' ? labels.concept(option.id) : option.name)
}

// The time left in the round, shrinking. Without motion it still updates, just without the slide.
export function TimeBar({ deadline, now }) {
  const t = useT()
  const left = Math.max(0, Date.parse(deadline) - now)
  const fraction = Math.min(1, left / ROUND_MS)
  const seconds = secondsUntil(deadline, now)
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between font-label text-[10px] text-muted">
        <span aria-hidden="true">{seconds > 0 ? t('duel.timeLeft', { seconds }) : t('duel.timeUp')}</span>
      </div>
      <div
        role="progressbar"
        aria-label={t('duel.timeLeft', { seconds })}
        aria-valuemin={0}
        aria-valuemax={ROUND_MS / 1000}
        aria-valuenow={seconds}
        className="mt-1 h-3 border-2 border-ink bg-mist"
      >
        <div
          className={`h-full motion-safe:transition-[width] motion-safe:duration-150 motion-safe:ease-linear ${fraction < 0.34 ? 'bg-secondary' : 'bg-primary'}`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  )
}

// An open round: the question, the clock and four big answers (keys 1 to 4 work too).
export const QuestionCard = forwardRef(function QuestionCard({ duel, now, pending, onAnswer }, headingRef) {
  const t = useT()
  const { current } = duel
  const optionLabel = useOptionLabel(current.type)
  const chosen = current.myChoice ?? pending
  const closed = Date.parse(current.deadline) <= now
  const locked = Boolean(chosen) || closed || duel.you === null
  return (
    <PixelCard className="p-4 sm:p-6">
      <p className="font-label text-xs text-secondary">
        {t('duel.round', { n: current.index + 1, total: duel.roundCount })} · {t(`duel.typeShort.${current.type}`)}
      </p>
      <TimeBar deadline={current.deadline} now={now} />
      <h2 ref={headingRef} tabIndex={-1} className="mt-4 font-pixel text-xl font-bold text-ink outline-none sm:text-2xl">
        {t(`duel.type.${current.type}`)}
      </h2>
      <Prompt type={current.type} prompt={current.prompt} />
      <div role="group" aria-label={t('duel.options')} className="mt-5 grid gap-3 sm:grid-cols-2">
        {current.options.map((option, index) => {
          const mine = chosen === option.id
          return (
            <button
              key={option.id}
              type="button"
              disabled={locked}
              aria-pressed={mine}
              aria-keyshortcuts={String(index + 1)}
              onClick={() => onAnswer(option.id)}
              className={`flex min-h-14 w-full min-w-0 items-center gap-3 border-2 border-ink px-3 py-3 text-left transition-[translate,box-shadow] duration-100 ${
                mine
                  ? 'bg-primary text-white shadow-pixel-ink'
                  : locked
                    ? 'bg-white text-muted'
                    : 'bg-white text-ink shadow-pixel-ink hover:bg-primary-soft active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--color-ink)]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid size-7 shrink-0 place-items-center border-2 font-label text-xs ${mine ? 'border-white' : 'border-ink'}`}
              >
                {index + 1}
              </span>
              <span className="min-w-0 break-words font-semibold">{optionLabel(option)}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-4 text-xs text-muted">{current.myChoice ? t('duel.locked') : t('duel.keys')}</p>
    </PixelCard>
  )
})

// One player's line in a closed round: right or wrong, how fast, the points, and a tab flag.
export function RoundLine({ result }) {
  const t = useT()
  const { locale } = useI18n()
  const verdict = result.choice === null ? t('duel.result.none') : result.correct ? t('duel.result.right') : t('duel.result.wrong')
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className={`font-label text-xs ${result.correct && !result.left ? 'text-secondary' : 'text-muted'}`}>{verdict}</span>
      {result.ms !== null && <span className="font-mono text-xs text-muted">{t('duel.result.seconds', { seconds: formatSeconds(result.ms, locale) })}</span>}
      <strong className="font-label text-xs text-ink tabular-nums">+{result.points}</strong>
      {result.left && <span className="bg-primary px-1 py-0.5 font-label text-[10px] leading-none text-white">{t('duel.tab.flag')}</span>}
    </span>
  )
}

// Between rounds: the question again with the right answer marked, and how both players did.
export function RevealCard({ duel, now }) {
  const t = useT()
  const { last, next } = duel
  const optionLabel = useOptionLabel(last.type)
  const myPick = duel.you === null ? null : last.players[duel.you].choice
  return (
    <PixelCard tone="secondary" className="p-4 sm:p-6">
      <p className="font-label text-xs text-secondary">
        {t('duel.round', { n: last.index + 1, total: duel.roundCount })} · {t(`duel.typeShort.${last.type}`)}
      </p>
      <h2 className="mt-3 font-pixel text-xl font-bold text-ink sm:text-2xl">
        {t('duel.reveal.title', { n: last.index + 1, answer: optionLabel(last.answer) })}
      </h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {last.options.map((option) => {
          const right = option.id === last.answer.id
          const picked = option.id === myPick
          return (
            <li
              key={option.id}
              className={`flex min-w-0 flex-wrap items-center gap-2 border-2 px-3 py-2 ${right ? 'border-ink bg-secondary text-white' : picked ? 'border-ink bg-white text-ink line-through' : 'border-line bg-white text-muted'}`}
            >
              <span className="min-w-0 break-words font-semibold">{optionLabel(option)}</span>
              {right && <span className="border-2 border-white px-1 font-label text-[10px] no-underline">{t('duel.reveal.right')}</span>}
              {picked && !right && <span className="border-2 border-ink px-1 font-label text-[10px]">{t('duel.reveal.yourPick')}</span>}
            </li>
          )
        })}
      </ul>
      <ul className="mt-4 space-y-2 border-t-2 border-dashed border-line pt-3">
        {seatsInOrder(duel).map(({ player, index }) => (
          <li key={index} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="min-w-0 truncate font-label text-xs text-ink">{playerName(t, player)}</span>
            <RoundLine result={last.players[index]} />
          </li>
        ))}
      </ul>
      <p className="mt-4 font-label text-xs text-muted">
        {next ? t('duel.nextIn', { seconds: secondsUntil(next.openAt, now) }) : t('duel.adding')}
      </p>
    </PixelCard>
  )
}

// The tab rule, always in sight during a duel, and a warning once I've left during a round.
export function TabBanner({ left }) {
  const t = useT()
  if (left) {
    return (
      <div role="alert" className="flex items-start gap-3 border-2 border-ink bg-primary-soft p-3 text-sm text-ink shadow-pixel">
        <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center bg-primary font-label text-xs text-white">
          !
        </span>
        <p>{t('duel.tab.left')}</p>
      </div>
    )
  }
  return (
    <p className="flex items-start gap-2 border-2 border-dashed border-ink/40 bg-white px-3 py-2 text-xs text-muted">
      <span aria-hidden="true" className="font-label text-primary">
        !
      </span>
      {t('duel.tab.rule')}
    </p>
  )
}
