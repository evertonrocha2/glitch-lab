import { conceptLabel } from '../../../shared/concepts.js'
import { splitError, weakSpot } from '../../lib/caseInfo.js'
import StepIcon from '../landing/StepIcon.jsx'
import PixelLogo from '../pixel/PixelLogo.jsx'

// The board's own colors, stacked: a PDF page is tall, not wide.
const COLUMNS = [
  { status: 'new', title: 'New', hint: 'Just investigated', icon: 'investigate', head: 'bg-mist', tone: 'text-ink' },
  { status: 'training', title: 'Training', hint: 'Practicing in the gym', icon: 'gym', head: 'bg-secondary-soft', tone: 'text-secondary' },
  { status: 'solved', title: 'Solved', hint: 'Passed 2 challenges', icon: 'solved', head: 'bg-primary-soft', tone: 'text-primary' },
]
const STRIPE = { new: 'bg-muted', training: 'bg-secondary', solved: 'bg-primary' }

const pad = (count) => String(count).padStart(2, '0')
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

function ProgressPanel({ progress }) {
  const earned = progress.badges.filter((badge) => badge.earned).length
  const numbers = [
    { label: 'XP', value: `${progress.xp} XP` },
    { label: 'Streak', value: plural(progress.streak, 'day') },
    { label: 'Badges', value: `${earned}/${progress.badges.length}` },
  ]
  return (
    <ul aria-label="Progress" className="w-80 shrink-0 border-2 border-ink bg-white shadow-pixel">
      <li className="border-b-2 border-ink bg-primary-soft px-4 py-2.5">
        <span className="font-label text-[10px] text-primary">Level {progress.level}</span>
        <strong className="block font-pixel text-xl leading-tight text-ink">{progress.title}</strong>
      </li>
      <li className="grid grid-cols-3 gap-[2px] bg-ink">
        {numbers.map((item) => (
          <span key={item.label} className="bg-white px-3 py-2">
            <span className="block font-label text-[9px] text-muted">{item.label}</span>
            <strong className="block font-label text-sm whitespace-nowrap text-ink">{item.value}</strong>
          </span>
        ))}
      </li>
    </ul>
  )
}

// The same four numbers as BoardStats on screen.
function Summary({ cases }) {
  const count = (status) => cases.filter((item) => item.status === status).length
  const spot = weakSpot(cases)
  const numbers = [
    { label: 'Cases', value: pad(cases.length), tone: 'text-ink' },
    { label: 'Training', value: pad(count('training')), tone: 'text-secondary' },
    { label: 'Solved', value: pad(count('solved')), tone: 'text-primary' },
  ]
  return (
    <ul aria-label="Board summary" data-sheet-block className="grid grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,2fr)] gap-[2px] border-2 border-ink bg-ink">
      {numbers.map((item) => (
        <li key={item.label} className="bg-white px-4 py-3">
          <span className="font-label text-xs text-muted">{item.label}</span>
          <strong className={`mt-1 block pt-1 font-label text-[28px] leading-none ${item.tone}`}>{item.value}</strong>
        </li>
      ))}
      <li className="bg-primary-soft px-4 py-3">
        <span className="font-label text-xs text-primary">Weak spot</span>
        <strong className="mt-1 block text-lg font-semibold text-ink">{spot ? conceptLabel(spot.concept) : 'None yet'}</strong>
        <span className="text-sm text-muted">{spot ? `${plural(spot.count, 'open case')} of this kind` : 'Nothing open right now.'}</span>
      </li>
    </ul>
  )
}

function SheetCard({ item }) {
  const { type, message } = splitError(item.error)
  const passed = Math.min(item.passedCount, 2)
  const clues = item.analysis?.pistas ?? []
  return (
    <article className="flex h-full border-2 border-ink bg-white shadow-pixel-muted">
      <span aria-hidden="true" className={`w-2 shrink-0 ${STRIPE[item.status]}`} />
      <div className="min-w-0 flex-1 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="bg-primary-soft px-1.5 py-0.5 font-semibold text-primary">{conceptLabel(item.concept)}</span>
          <span className="border border-line px-1.5 py-0.5 font-mono text-muted">{item.language}</span>
          <span className="ml-auto flex items-center gap-1.5 text-muted">
            <span aria-hidden="true" className="flex gap-1">
              {[0, 1].map((step) => (
                <span key={step} className={`size-2.5 border-2 border-ink ${step < passed ? 'bg-secondary' : 'bg-white'}`} />
              ))}
            </span>
            {passed}/2
          </span>
        </div>
        <p className="mt-2 font-pixel text-xl leading-tight font-bold wrap-break-word text-ink">{type}</p>
        {message && <p className="mt-1 line-clamp-2 font-mono text-[13px] leading-snug wrap-break-word text-ink/75">{message}</p>}
        {item.analysis?.causa && (
          <div className="mt-3 border-t-2 border-dashed border-line pt-2.5">
            <p className="font-label text-[10px] text-primary">Why it broke</p>
            <p className="mt-1 line-clamp-3 text-[13px] leading-snug wrap-break-word text-ink">{item.analysis.causa}</p>
          </div>
        )}
        {clues.length > 0 && (
          <div className="mt-2.5">
            <p className="font-label text-[10px] text-secondary">Clues</p>
            <ol className="mt-1 space-y-0.5 text-[13px] leading-snug text-ink/85">
              {clues.map((clue, index) => (
                <li key={clue} className="flex gap-2">
                  <span aria-hidden="true" className="font-label text-[10px] leading-[1.55] text-secondary">
                    {index + 1}
                  </span>
                  <span className="min-w-0 line-clamp-2 wrap-break-word">{clue}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </article>
  )
}

// A column header carries no break marker, so a page never ends on a header alone.
function ColumnSection({ column, items }) {
  return (
    <section aria-labelledby={`sheet-${column.status}`} data-sheet-block className="pt-8">
      <header className={`flex items-center justify-between gap-4 border-2 border-ink px-4 py-2.5 ${column.head}`}>
        <div className="flex items-baseline gap-3">
          <h2 id={`sheet-${column.status}`} className={`flex items-center gap-2 font-label text-base ${column.tone}`}>
            <StepIcon kind={column.icon} className="h-4 w-auto" />
            {column.title}
          </h2>
          <span className="text-[13px] text-muted">{column.hint}</span>
        </div>
        <span className="min-w-11 border-2 border-ink bg-white px-1.5 text-center font-label text-lg leading-8 text-ink">{pad(items.length)}</span>
      </header>
      {items.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {items.map((item) => (
            // The padding holds the card's shadow, so a page break below it keeps the shadow.
            <li key={item.id} data-sheet-block className="pr-1 pb-1">
              <SheetCard item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p data-sheet-block className="mt-4 border-2 border-dashed border-line px-4 py-3 text-sm text-muted">
          Nothing here yet.
        </p>
      )}
    </section>
  )
}

// First lines of the note's writing, skipping what's empty.
function preview(note) {
  const text = note.blocks.find((block) => (block.type === 'text' || block.type === 'heading') && block.text.trim())
  return text?.text.trim() ?? ''
}

function NotesSection({ notes }) {
  return (
    <section aria-labelledby="sheet-notes" className="pt-8">
      <header className="flex items-center justify-between gap-4 border-2 border-ink bg-white px-4 py-2.5">
        <h2 id="sheet-notes" className="font-label text-base text-ink">
          Notes
        </h2>
        <span className="min-w-11 border-2 border-ink bg-mist px-1.5 text-center font-label text-lg leading-8 text-ink">{pad(notes.length)}</span>
      </header>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {notes.map((note) => {
          const text = preview(note)
          const linked = note.blocks.filter((block) => block.type === 'case').length
          return (
            <li key={note.id} data-sheet-block className="pr-1 pb-1">
              <div className="h-full border-2 border-ink bg-white px-4 py-3 shadow-pixel-muted">
                <p className="font-pixel text-lg leading-tight font-bold wrap-break-word text-ink">{note.title || 'Untitled'}</p>
                {text ? (
                  <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug wrap-break-word whitespace-pre-line text-ink/80">{text}</p>
                ) : (
                  <p className="mt-1.5 text-[13px] text-muted">Nothing written yet.</p>
                )}
                {linked > 0 && <p className="mt-2 font-label text-[10px] text-muted">{plural(linked, 'case')} linked</p>}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// A print-ready picture of the whole board, for the PNG and PDF exports: fixed width, white, Pixel Lab look.
export default function BoardSheet({ cases, notes, progress, date }) {
  return (
    <div className="w-250 bg-white font-sans text-[15px] text-ink">
      <header data-sheet-block className="relative overflow-hidden border-b-2 border-ink">
        <div aria-hidden="true" className="dither-primary absolute inset-0 opacity-20" />
        <div className="relative flex items-center justify-between gap-6 px-12 py-6">
          <span className="flex items-center gap-3 font-pixel text-2xl font-bold">
            <PixelLogo className="size-9" />
            <span>Glitch Detective</span>
          </span>
          <span className="border-2 border-ink bg-white px-2.5 py-1.5 font-label text-[10px] text-ink shadow-pixel">Exported {date}</span>
        </div>
      </header>

      <main className="px-12 pt-10 pb-12">
        <div data-sheet-block className="flex items-end justify-between gap-8">
          <div>
            <p className="font-label text-xs text-secondary">&gt; case board_</p>
            <h1 className="mt-3 font-pixel text-[44px] leading-[1.1] font-bold text-ink">Case board</h1>
            <p className="mt-2 text-muted">Every error investigated, where it stands, and why it broke.</p>
          </div>
          {progress && <ProgressPanel progress={progress} />}
        </div>
        <div className="mt-8">
          <Summary cases={cases} />
        </div>

        {COLUMNS.map((column) => (
          <ColumnSection key={column.status} column={column} items={cases.filter((item) => item.status === column.status)} />
        ))}

        {notes.length > 0 && <NotesSection notes={notes} />}
      </main>

      <footer className="mx-12 flex items-center justify-between gap-6 border-t-2 border-dashed border-line py-6 font-label text-[10px] text-muted">
        <span className="flex items-center gap-2">
          <PixelLogo className="size-4" />
          Made with Glitch Detective
        </span>
        <span>Paste an error. Learn why. Stop writing it.</span>
      </footer>
    </div>
  )
}
