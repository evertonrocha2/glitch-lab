import { DAILY_XP } from '../../../../shared/daily.js'
import { languageName } from '../../../lib/daily.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../../lib/i18n/labels.js'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../ui/pixel-card/pixel-card.jsx'
import SwitchLanguage from '../switch-language/switch-language.jsx'

// Easy leans blue (practice), hard goes full purple.
export const DIFFICULTY_STYLES = {
  easy: { chip: 'bg-secondary-soft text-secondary', tone: 'secondary', button: 'secondary' },
  medium: { chip: 'bg-primary-soft text-primary', tone: 'primary', button: 'primary' },
  hard: { chip: 'bg-primary text-white', tone: 'primary', button: 'primary' },
}

const ACTIONS = { new: 'board.puzzle.solve', open: 'board.puzzle.continue', passed: 'board.puzzle.review' }
export const xpFor = (puzzle) => (puzzle.kind === 'global' ? DAILY_XP.global : DAILY_XP[puzzle.difficulty])

export function PuzzleStatus({ puzzle }) {
  const t = useT()
  if (puzzle.status === 'passed') {
    return (
      <span className="inline-flex items-center gap-1.5 border-2 border-secondary bg-white px-1.5 py-0.5 font-label text-[10px] text-secondary">
        <svg viewBox="0 0 5 4" shapeRendering="crispEdges" aria-hidden="true" className="size-2.5 fill-secondary">
          <rect x="0" y="2" width="1" height="1" />
          <rect x="1" y="3" width="1" height="1" />
          <rect x="2" y="2" width="1" height="1" />
          <rect x="3" y="1" width="1" height="1" />
          <rect x="4" y="0" width="1" height="1" />
        </svg>
        {t('board.puzzle.solved')}
      </span>
    )
  }
  if (puzzle.status === 'open') {
    return (
      <span className="text-xs text-ink">
        {puzzle.attempts
          ? t('board.puzzle.inProgressAttempts', { attempts: t('board.puzzle.attempts', { count: puzzle.attempts }) })
          : t('board.puzzle.inProgress')}
      </span>
    )
  }
  return <span className="text-xs text-muted">{t('board.puzzle.notStarted')}</span>
}

// Language and bug type, as small tags.
export function PuzzleTags({ puzzle }) {
  const labels = useLabels()
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs">
      <span className="border border-line bg-white px-1.5 py-0.5 font-mono text-muted">{languageName(puzzle.language)}</span>
      <span className="bg-mist px-1.5 py-0.5 font-semibold text-ink">{labels.concept(puzzle.concept)}</span>
    </p>
  )
}

export function StartButton({ puzzle, onStart, busy, variant, className = '' }) {
  const t = useT()
  const action = t(ACTIONS[puzzle.status] ?? ACTIONS.new)
  return (
    <PixelButton
      variant={puzzle.status === 'passed' ? 'ghost' : variant}
      onClick={() => onStart(puzzle)}
      disabled={busy}
      aria-label={t('board.puzzle.action', { action, title: puzzle.title })}
      className={className}
    >
      {action}
    </PixelButton>
  )
}

// One daily puzzle: what it is about, never its code. "Solve" opens it in the gym; "Switch language"
// moves it to another programming language, once (onSwitched gets the API's answer).
export default function PuzzleCard({ puzzle, onStart, busy, onSwitched }) {
  const labels = useLabels()
  const style = DIFFICULTY_STYLES[puzzle.difficulty] ?? DIFFICULTY_STYLES.medium
  return (
    <PixelCard tone={puzzle.status === 'passed' ? 'muted' : style.tone} className="relative flex h-full flex-col overflow-hidden p-5">
      {puzzle.difficulty === 'hard' && <span aria-hidden="true" className="dither-primary absolute inset-y-0 right-0 w-1/3 opacity-15" />}
      <div className="relative flex items-center justify-between gap-2">
        <span className={`px-1.5 py-0.5 font-label text-[10px] ${style.chip}`}>{labels.difficulty(puzzle.difficulty).toLowerCase()}</span>
        <span className="font-label text-[10px] text-muted">+{xpFor(puzzle)} XP</span>
      </div>
      <h3 className="relative mt-3 font-pixel text-xl font-bold leading-tight text-ink">{puzzle.title}</h3>
      <div className="relative mt-3">
        <PuzzleTags puzzle={puzzle} />
      </div>
      <p className="relative mt-3 line-clamp-2 font-mono text-xs leading-relaxed text-muted wrap-break-word">
        <span aria-hidden="true" className="font-bold text-primary">
          &gt;{' '}
        </span>
        {puzzle.symptom}
      </p>
      <SwitchLanguage puzzle={puzzle} started={puzzle.status !== 'new'} onSwitched={onSwitched} className="relative mt-3 self-start" />
      <div className="relative mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <PuzzleStatus puzzle={puzzle} />
        <StartButton puzzle={puzzle} onStart={onStart} busy={busy} variant={style.button} />
      </div>
    </PixelCard>
  )
}
