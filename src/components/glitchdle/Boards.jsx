import { ATTRIBUTES, label } from '../../../shared/riddle/languages.js'

// The three Glitchdle boards. Grading stays in the palette: purple is a match, blue is close
// (lists that overlap), white is a miss.
export const STATUS = {
  match: { cell: 'bg-primary text-white', swatch: 'bg-primary', word: 'Match' },
  partial: { cell: 'bg-secondary-soft text-secondary', swatch: 'bg-secondary-soft', word: 'Close' },
  miss: { cell: 'bg-white text-ink', swatch: 'bg-white', word: 'Miss' },
}

const LABEL_TONE = { match: 'text-white/80', partial: 'text-secondary/80', miss: 'text-muted' }
const NAMES = Object.fromEntries(ATTRIBUTES.map((item) => [item.key, item.name]))
const valueText = (value) => (Array.isArray(value) ? value.map(label).join(', ') : typeof value === 'number' ? String(value) : label(value))

// A 7x7 pixel arrow: up means the answer appeared later.
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

export function Legend() {
  return (
    <ul aria-label="What the colors mean" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {[
        ['match', 'Same'],
        ['partial', 'Some in common'],
        ['miss', 'Different'],
      ].map(([status, text]) => (
        <li key={status} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-3 border-2 border-ink ${STATUS[status].swatch}`} />
          {text}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <YearArrow direction="higher" className="size-3.5 text-ink" />
        Answer is newer
      </li>
    </ul>
  )
}

function Cell({ cell, index, animate }) {
  const style = STATUS[cell.status]
  const hint = cell.direction ? `, the answer appeared ${cell.direction === 'higher' ? 'later' : 'earlier'}` : ''
  return (
    <div
      style={animate ? { animationDelay: `${index * 90}ms` } : undefined}
      className={`flex min-h-16 min-w-0 flex-col justify-between gap-1 px-2 py-1.5 ${style.cell} ${animate ? 'motion-safe:animate-flip-in' : ''}`}
    >
      <span className={`font-label text-[10px] leading-tight ${LABEL_TONE[cell.status]}`}>{NAMES[cell.key]}</span>
      <span className="flex items-end justify-between gap-1 text-xs leading-snug font-semibold wrap-break-word">
        <span className="min-w-0">{valueText(cell.value)}</span>
        {cell.direction && <YearArrow direction={cell.direction} className="size-4 shrink-0" />}
      </span>
      <span className="sr-only">
        ({style.word}
        {hint})
      </span>
    </div>
  )
}

// Classic: one card per guess, newest on top, each attribute graded against the answer.
export function ClassicBoard({ guesses, animateId }) {
  if (guesses.length === 0) {
    return <p className="border-2 border-dashed border-line bg-white px-4 py-6 text-center text-sm text-muted">Your guesses show up here, newest on top.</p>
  }
  return (
    <ol aria-label="Your guesses" className="space-y-3">
      {guesses.map((guess) => (
        <li key={guess.id} aria-label={guess.name} className="border-2 border-ink bg-ink shadow-pixel-muted">
          <div className="flex items-center justify-between gap-2 bg-white px-3 py-1.5">
            <span className="font-pixel text-lg font-bold text-ink">{guess.name}</span>
            {guess.correct && (
              <span className="flex items-center gap-1 font-label text-[10px] text-primary">
                <Check /> Solved
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-[2px] border-t-2 border-ink lg:grid-cols-8">
            {guess.cells.map((cell, index) => (
              <Cell key={cell.key} cell={cell} index={index} animate={guess.id === animateId} />
            ))}
          </div>
        </li>
      ))}
    </ol>
  )
}

// Error and Snippet: just the names, crossed or ticked, newest first.
export function GuessList({ guesses, animateId }) {
  if (guesses.length === 0) return null
  return (
    <ol aria-label="Your guesses" className="flex flex-wrap gap-2">
      {guesses.map((guess) => (
        <li
          key={guess.id}
          className={`flex items-center gap-1.5 border-2 border-ink px-2 py-1 text-sm ${guess.correct ? 'bg-primary text-white' : 'bg-white text-muted line-through decoration-2'} ${
            guess.id === animateId ? 'motion-safe:animate-flip-in' : ''
          }`}
        >
          {guess.correct ? <Check /> : <Cross />}
          <span>{guess.name}</span>
          <span className="sr-only">{guess.correct ? '(right)' : '(wrong)'}</span>
        </li>
      ))}
    </ol>
  )
}

// Error: the message as a terminal would print it, plus the hints it has unlocked.
export function ErrorBoard({ state }) {
  const locked = 2 - state.hints.length
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
      <ul aria-label="Hints" className="grid gap-2 sm:grid-cols-2">
        {state.hints.map((hint) => (
          <li key={hint.label} className="border-2 border-ink bg-secondary-soft px-3 py-2">
            <span className="block font-label text-[10px] text-secondary">{hint.label}</span>
            <span className="font-mono text-sm font-semibold text-ink">{hint.value}</span>
          </li>
        ))}
        {Array.from({ length: locked }, (_, index) => (
          <li key={`locked-${index}`} className="border-2 border-dashed border-line bg-white px-3 py-2 text-xs text-muted">
            <span className="block font-label text-[10px]">Hint {state.hints.length + index + 1} locked</span>
            {index === 0 && state.nextHintIn
              ? `Unlocks after ${state.nextHintIn} more wrong ${state.nextHintIn === 1 ? 'guess' : 'guesses'}`
              : 'Unlocks later'}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Snippet: the code with the hidden lines as dither bars as long as the real line.
export function SnippetBoard({ state }) {
  const hidden = state.lines.filter((line) => line.hidden).length
  return (
    <figure className="overflow-hidden border-2 border-ink bg-white shadow-pixel">
      <figcaption className="flex items-center justify-between gap-2 border-b-2 border-ink bg-mist px-3 py-1.5 font-label text-[10px] text-muted">
        <span>snippet</span>
        <span>{hidden ? `${hidden} ${hidden === 1 ? 'line' : 'lines'} hidden` : 'all lines shown'}</span>
      </figcaption>
      <ol aria-label="Code" className="overflow-x-auto py-3 font-mono text-sm leading-6">
        {state.lines.map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are fixed for the day
          <li key={index} className="flex gap-3 pr-4">
            <span aria-hidden="true" className="w-8 shrink-0 text-right text-muted/60 select-none">
              {index + 1}
            </span>
            {line.hidden ? (
              <span className="flex min-w-0 flex-1 items-center">
                <span className="dither-hidden block h-3.5 max-w-full" style={{ width: `${Math.max(2, line.width)}ch` }} />
                <span className="sr-only">Hidden line</span>
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
