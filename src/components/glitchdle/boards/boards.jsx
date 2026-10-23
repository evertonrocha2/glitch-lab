import { memo, useMemo } from 'react'
import { LABELS } from '../../../../shared/riddle/languages.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { categoryValueName, traitName, useLabels } from '../../../lib/i18n/labels.js'

// The Glitchdle boards. Grading: purple is a match, amber with a hatch is close (lists that
// overlap, or values in the same family), white is a miss. Close never leans on color alone: the
// hatch and a "~" mark tell it apart for colorblind players too. Every text on a cell passes WCAG
// AA (white on purple 5.9:1, ink on amber 9.5:1, muted on white 6.5:1).
const HATCH = { backgroundImage: 'repeating-linear-gradient(135deg, rgb(28 29 38 / 0.16) 0 2px, transparent 2px 7px)' }
export const STATUS = {
  match: { cell: 'bg-primary text-white', label: 'text-white', swatch: 'bg-primary' },
  partial: { cell: 'bg-[#f5b800] text-ink', label: 'text-ink', swatch: 'bg-[#f5b800]', style: HATCH },
  miss: { cell: 'bg-white text-ink', label: 'text-muted', swatch: 'bg-white' },
}

const valueText = (name, value) => (Array.isArray(value) ? value.map(name).join(', ') : typeof value === 'number' ? String(value) : name(value))

// The server names the Error hints in English ("File extension", "Syntax family"); the syntax hint's
// value is an English trait label too. Both are matched back to their ids and named in the reader's language.
const HINT_KEYS = { 'File extension': 'extension', 'Syntax family': 'syntax' }
const TRAIT_IDS = Object.fromEntries(Object.entries(LABELS).map(([id, text]) => [text, id]))

// A 7x7 pixel arrow: up means the answer is newer (or ranks higher).
const ARROW_UP = ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..', '..###..']
export function YearArrow({ direction, className = 'size-4' }) {
  const rows = direction === 'higher' ? ARROW_UP : [...ARROW_UP].reverse()
  return (
    <svg viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" className={`${className} fill-current`}>
      {rows.flatMap((row, y) => [...row].map((char, x) => (char === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)))}
    </svg>
  )
}

export function Check({ className = 'size-2.5' }) {
  return (
    <svg viewBox="0 0 5 4" shapeRendering="crispEdges" aria-hidden="true" className={`${className} fill-current`}>
      <rect x="0" y="2" width="1" height="1" />
      <rect x="1" y="3" width="1" height="1" />
      <rect x="2" y="2" width="1" height="1" />
      <rect x="3" y="1" width="1" height="1" />
      <rect x="4" y="0" width="1" height="1" />
    </svg>
  )
}

export function Cross({ className = 'size-2.5' }) {
  return (
    <svg viewBox="0 0 5 5" shapeRendering="crispEdges" aria-hidden="true" className={`${className} fill-current`}>
      {[0, 1, 2, 3, 4].map((step) => (
        <g key={step}>
          <rect x={step} y={step} width="1" height="1" />
          <rect x={4 - step} y={step} width="1" height="1" />
        </g>
      ))}
    </svg>
  )
}

// The swatch a legend shows is the board cell itself, small: same color, hatch and border.
function Swatch({ status }) {
  const style = STATUS[status]
  return <span aria-hidden="true" style={style.style} className={`size-5 shrink-0 border-2 border-ink ${style.swatch}`} />
}

// ranked: the board has a Stack Overflow column, whose arrow means "more questions".
export function Legend({ ranked = false }) {
  const t = useT()
  return (
    <ul aria-label={t('app.glitchdle.legend')} className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink">
      {[
        ['match', t('app.glitchdle.legend.match')],
        ['partial', t('app.glitchdle.legend.partial')],
        ['miss', t('app.glitchdle.legend.miss')],
      ].map(([status, text]) => (
        <li key={status} className="flex items-center gap-2">
          <Swatch status={status} />
          {text}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center border-2 border-ink bg-white">
          <YearArrow direction="higher" className="size-3 text-ink" />
        </span>
        {t(ranked ? 'app.glitchdle.legend.higher' : 'app.glitchdle.legend.newer')}
      </li>
    </ul>
  )
}

const DIRECTION_HINTS = {
  year: { higher: 'app.glitchdle.later', lower: 'app.glitchdle.earlier' },
  rank: { higher: 'app.glitchdle.more', lower: 'app.glitchdle.fewer' },
}

// wide: the last of an odd number of cells fills the row, so no empty slot shows.
function Cell({ cell, kind, label, name, index, animate, wide }) {
  const style = STATUS[cell.status]
  const t = useT()
  const hint = cell.direction ? t(DIRECTION_HINTS[kind]?.[cell.direction] ?? DIRECTION_HINTS.year[cell.direction]) : ''
  return (
    <div
      style={{ ...style.style, ...(animate ? { animationDelay: `${index * 90}ms` } : null) }}
      className={`flex min-h-16 min-w-0 flex-col justify-between gap-1 px-2 py-1.5 ${wide ? 'col-span-2 @3xl:col-span-1' : ''} ${style.cell} ${animate ? 'motion-safe:animate-flip-in' : ''}`}
    >
      <span className={`flex items-start justify-between gap-1 font-label text-[10px] leading-tight ${style.label}`}>
        <span className="min-w-0">{label}</span>
        {cell.status === 'partial' && (
          <span aria-hidden="true" className="shrink-0 font-bold">
            ~
          </span>
        )}
      </span>
      <span className="flex items-end justify-between gap-1 text-xs leading-snug font-semibold wrap-break-word">
        <span className="min-w-0">{valueText(name, cell.value)}</span>
        {cell.direction && <YearArrow direction={cell.direction} className="size-4 shrink-0" />}
      </span>
      <span className="sr-only">
        ({t(`app.glitchdle.status.${cell.status}`)}
        {hint})
      </span>
    </div>
  )
}

// One guess card. Memoized: a new guess or a keystroke in the guess box leaves old cards alone.
const GuessCard = memo(function GuessCard({ guess, attributes, columns, labelOf, name, animate }) {
  const t = useT()
  return (
    // content-visibility: a long board only lays out the cards on screen.
    <li aria-label={guess.name} className="border-2 border-ink bg-ink shadow-pixel-muted [contain-intrinsic-size:auto_10rem] [content-visibility:auto]">
      <div className="flex items-center justify-between gap-2 bg-white px-3 py-1.5">
        <span className="font-pixel text-lg font-bold text-ink">{guess.name}</span>
        {guess.correct && (
          <span className="flex items-center gap-1 font-label text-[10px] text-primary">
            <Check /> {t('app.glitchdle.solved')}
          </span>
        )}
      </div>
      {/* All across only when the board itself is wide enough, not just the screen. */}
      <div className={`grid grid-cols-2 gap-[2px] border-t-2 border-ink @sm:grid-cols-4 ${columns === 7 ? '@3xl:grid-cols-7' : '@3xl:grid-cols-8'}`}>
        {guess.cells.map((cell, index) => (
          <Cell
            key={cell.key}
            cell={cell}
            kind={attributes[index]?.kind}
            label={labelOf(cell.key)}
            name={name}
            index={index}
            animate={animate}
            wide={columns % 2 === 1 && index === columns - 1}
          />
        ))}
      </div>
    </li>
  )
})

// Classic boards (languages' Classic, frameworks, databases): one card per guess, newest on top,
// each attribute graded against the answer. category: 'languages', 'frameworks' or 'databases'.
export function ClassicBoard({ guesses, animateId, category = 'languages', attributes = [] }) {
  const t = useT()
  // Stable for a language and category, so the memoized cards skip re-rendering.
  const { labelOf, name } = useMemo(() => {
    const languages = category === 'languages'
    return {
      labelOf: (key) => t(languages ? `app.glitchdle.attr.${key}` : `app.glitchdle.attr.${category}.${key}`),
      name: languages ? (value) => traitName(t, value) : (value) => categoryValueName(t, category, value),
    }
  }, [t, category])
  if (guesses.length === 0) {
    return <p className="border-2 border-dashed border-line bg-white px-4 py-6 text-center text-sm text-muted">{t('app.glitchdle.empty')}</p>
  }
  return (
    <ol aria-label={t('app.glitchdle.yourGuesses')} className="@container space-y-3">
      {guesses.map((guess) => (
        <GuessCard
          key={guess.id}
          guess={guess}
          attributes={attributes}
          columns={guess.cells.length}
          labelOf={labelOf}
          name={name}
          animate={guess.id === animateId}
        />
      ))}
    </ol>
  )
}

// Error and Snippet: just the names, crossed or ticked, newest first.
export function GuessList({ guesses, animateId }) {
  const t = useT()
  if (guesses.length === 0) return null
  return (
    <ol aria-label={t('app.glitchdle.yourGuesses')} className="flex flex-wrap gap-2">
      {guesses.map((guess) => (
        <li
          key={guess.id}
          className={`flex items-center gap-1.5 border-2 border-ink px-2 py-1 text-sm ${guess.correct ? 'bg-primary text-white' : 'bg-white text-muted line-through decoration-2'} ${
            guess.id === animateId ? 'motion-safe:animate-flip-in' : ''
          }`}
        >
          {guess.correct ? <Check /> : <Cross />}
          <span>{guess.name}</span>
          <span className="sr-only">{guess.correct ? t('app.glitchdle.right') : t('app.glitchdle.wrong')}</span>
        </li>
      ))}
    </ol>
  )
}

// Error: the message as a terminal would print it, plus the hints it has unlocked.
export function ErrorBoard({ state }) {
  const locked = 2 - state.hints.length
  const t = useT()
  const labels = useLabels()
  return (
    <div className="space-y-4">
      <figure className="overflow-hidden border-2 border-ink bg-white shadow-pixel">
        <figcaption className="flex items-center gap-2 border-b-2 border-ink bg-mist px-3 py-1.5 font-label text-[10px] text-muted">
          <span aria-hidden="true" className="flex gap-1">
            <span className="size-2 bg-primary" />
            <span className="size-2 bg-secondary" />
            <span className="size-2 bg-line" />
          </span>
          stderr
        </figcaption>
        <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-ink wrap-break-word">{state.text}</pre>
      </figure>
      <ul aria-label={t('app.glitchdle.hints')} className="grid gap-2 sm:grid-cols-2">
        {state.hints.map((hint) => (
          <li key={hint.label} className="border-2 border-ink bg-secondary-soft px-3 py-2">
            <span className="block font-label text-[10px] text-secondary">
              {HINT_KEYS[hint.label] ? t(`app.glitchdle.hint.${HINT_KEYS[hint.label]}`) : hint.label}
            </span>
            <span className="font-mono text-sm font-semibold text-ink">{TRAIT_IDS[hint.value] ? labels.trait(TRAIT_IDS[hint.value]) : hint.value}</span>
          </li>
        ))}
        {Array.from({ length: locked }, (_, index) => (
          <li key={`locked-${index}`} className="border-2 border-dashed border-line bg-white px-3 py-2 text-xs text-muted">
            <span className="block font-label text-[10px]">{t('app.glitchdle.hintLocked', { number: state.hints.length + index + 1 })}</span>
            {index === 0 && state.nextHintIn
              ? t('app.glitchdle.unlocksAfter', { count: state.nextHintIn })
              : t('app.glitchdle.unlocksLater')}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Snippet: the code with the hidden lines as dither bars as long as the real line.
export function SnippetBoard({ state }) {
  const hidden = state.lines.filter((line) => line.hidden).length
  const t = useT()
  return (
    <figure className="overflow-hidden border-2 border-ink bg-white shadow-pixel">
      <figcaption className="flex items-center justify-between gap-2 border-b-2 border-ink bg-mist px-3 py-1.5 font-label text-[10px] text-muted">
        <span>{t('app.glitchdle.snippet')}</span>
        <span>{hidden ? t('app.glitchdle.linesHidden', { count: hidden }) : t('app.glitchdle.allShown')}</span>
      </figcaption>
      <ol aria-label={t('app.glitchdle.code')} className="overflow-x-auto py-3 font-mono text-sm leading-6">
        {state.lines.map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are fixed for the day
          <li key={index} className="flex gap-3 pr-4">
            <span aria-hidden="true" className="w-8 shrink-0 text-right text-muted/60 select-none">
              {index + 1}
            </span>
            {line.hidden ? (
              <span className="flex min-w-0 flex-1 items-center">
                <span className="dither-hidden block h-3.5 max-w-full" style={{ width: `${Math.max(2, line.width)}ch` }} />
                <span className="sr-only">{t('app.glitchdle.hiddenLine')}</span>
              </span>
            ) : (
              <code className="whitespace-pre text-ink">{line.text || ' '}</code>
            )}
          </li>
        ))}
      </ol>
    </figure>
  )
}
