import { splitError, weakSpot } from '../../../lib/case-info.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../../lib/i18n/labels.js'
import StepIcon from '../../ui/step-icon/step-icon.jsx'
import PixelLogo from '../../ui/pixel-logo/pixel-logo.jsx'

// The board's own colors, stacked: a PDF page is tall, not wide.
const COLUMNS = [
  { status: 'new', icon: 'investigate', head: 'bg-mist', tone: 'text-ink' },
  { status: 'training', icon: 'gym', head: 'bg-secondary-soft', tone: 'text-secondary' },
  { status: 'solved', icon: 'solved', head: 'bg-primary-soft', tone: 'text-primary' },
]
const STRIPE = { new: 'bg-muted', training: 'bg-secondary', solved: 'bg-primary' }

const pad = (count) => String(count).padStart(2, '0')

function ProgressPanel({ progress }) {
  const t = useT()
  const labels = useLabels()
  const earned = progress.badges.filter((badge) => badge.earned).length
  const numbers = [
    { label: t('board.sheet.xp'), value: `${progress.xp} XP` },
    { label: t('board.sheet.streak'), value: progress.streak === 0 ? t('board.sheet.daysZero') : t('board.sheet.days', { count: progress.streak }) },
    { label: t('board.sheet.badges'), value: `${earned}/${progress.badges.length}` },
  ]
  return (
    <ul aria-label={t('board.sheet.progress')} className="w-80 shrink-0 border-2 border-ink bg-white shadow-pixel">
      <li className="border-b-2 border-ink bg-primary-soft px-4 py-2.5">
        <span className="font-label text-[10px] text-primary">{t('board.sheet.level', { level: progress.level })}</span>
        <strong className="block font-pixel text-xl leading-tight text-ink">{labels.level(progress.level) || progress.title}</strong>
      </li>
      <li className="grid grid-cols-3 gap-[2px] bg-ink">
        {numbers.map((item) => (
          <span key={item.label} className="bg-white px-3 py-2">
            <span className="block font-label text-[10px] text-muted">{item.label}</span>
            <strong className="block font-label text-sm whitespace-nowrap text-ink">{item.value}</strong>
          </span>
        ))}
      </li>
    </ul>
  )
}

// The same four numbers as BoardStats on screen.
function Summary({ cases }) {
  const t = useT()
  const labels = useLabels()
  const count = (status) => cases.filter((item) => item.status === status).length
  const spot = weakSpot(cases)
  const numbers = [
    { label: t('board.stats.cases'), value: pad(cases.length), tone: 'text-ink' },
    { label: labels.status('training'), value: pad(count('training')), tone: 'text-secondary' },
    { label: labels.status('solved'), value: pad(count('solved')), tone: 'text-primary' },
  ]
  return (
    <ul aria-label={t('board.stats.label')} data-sheet-block className="grid grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,2fr)] gap-[2px] border-2 border-ink bg-ink">
      {numbers.map((item) => (
        <li key={item.label} className="bg-white px-4 py-3">
          <span className="font-label text-xs text-muted">{item.label}</span>
          <strong className={`mt-1 block pt-1 font-pixel font-bold text-[28px] leading-none ${item.tone}`}>{item.value}</strong>
        </li>
      ))}
      <li className="bg-primary-soft px-4 py-3">
        <span className="font-label text-xs text-primary">{t('board.stats.weakSpot')}</span>
        <strong className="mt-1 block text-lg font-semibold text-ink">{spot ? labels.concept(spot.concept) : t('board.stats.noneYet')}</strong>
        <span className="text-sm text-muted">{spot ? t('board.sheet.openOfKind', { count: spot.count }) : t('board.sheet.nothingOpen')}</span>
      </li>
    </ul>
  )
}

function SheetCard({ item }) {
  const t = useT()
  const labels = useLabels()
  const { type, message } = splitError(item.error)
  const passed = Math.min(item.passedCount, 2)
  const clues = item.analysis?.pistas ?? []
  return (
    <article className="flex h-full border-2 border-ink bg-white shadow-pixel-muted">
      <span aria-hidden="true" className={`w-2 shrink-0 ${STRIPE[item.status]}`} />
      <div className="min-w-0 flex-1 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="bg-primary-soft px-1.5 py-0.5 font-semibold text-primary">{labels.concept(item.concept)}</span>
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
        {message && <p className="mt-1 line-clamp-2 font-mono text-sm leading-snug wrap-break-word text-ink/75">{message}</p>}
        {item.analysis?.causa && (
          <div className="mt-3 border-t-2 border-dashed border-line pt-2.5">
            <p className="font-label text-[10px] text-primary">{t('board.sheet.whyItBroke')}</p>
            <p className="mt-1 line-clamp-3 text-sm leading-snug wrap-break-word text-ink">{item.analysis.causa}</p>
          </div>
        )}
        {clues.length > 0 && (
          <div className="mt-2.5">
            <p className="font-label text-[10px] text-secondary">{t('board.sheet.clues')}</p>
            <ol className="mt-1 space-y-0.5 text-sm leading-snug text-ink/85">
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
  const t = useT()
  const labels = useLabels()
  return (
    <section aria-labelledby={`sheet-${column.status}`} data-sheet-block className="pt-8">
      <header className={`flex items-center justify-between gap-4 border-2 border-ink px-4 py-2.5 ${column.head}`}>
        <div className="flex items-baseline gap-3">
          <h2 id={`sheet-${column.status}`} className={`flex items-center gap-2 font-label text-base ${column.tone}`}>
            <StepIcon kind={column.icon} className="h-4 w-auto" />
            {labels.status(column.status)}
          </h2>
          <span className="text-sm text-muted">{t(`board.column.${column.status}.hint`)}</span>
        </div>
        <span className="min-w-11 border-2 border-ink bg-white px-1.5 text-center font-pixel font-bold text-lg leading-8 text-ink">{pad(items.length)}</span>
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
          {t('board.sheet.nothingHere')}
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
  const t = useT()
  return (
    <section aria-labelledby="sheet-notes" className="pt-8">
      <header className="flex items-center justify-between gap-4 border-2 border-ink bg-white px-4 py-2.5">
        <h2 id="sheet-notes" className="font-label text-base text-ink">
          {t('board.sheet.notes')}
        </h2>
        <span className="min-w-11 border-2 border-ink bg-mist px-1.5 text-center font-pixel font-bold text-lg leading-8 text-ink">{pad(notes.length)}</span>
      </header>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {notes.map((note) => {
          const text = preview(note)
          const linked = note.blocks.filter((block) => block.type === 'case').length
          return (
            <li key={note.id} data-sheet-block className="pr-1 pb-1">
              <div className="h-full border-2 border-ink bg-white px-4 py-3 shadow-pixel-muted">
                <p className="font-pixel text-lg leading-tight font-bold wrap-break-word text-ink">{note.title || t('board.sheet.untitled')}</p>
                {text ? (
                  <p className="mt-1.5 line-clamp-3 text-sm leading-snug wrap-break-word whitespace-pre-line text-ink/80">{text}</p>
                ) : (
                  <p className="mt-1.5 text-sm text-muted">{t('board.sheet.nothingWritten')}</p>
                )}
                {linked > 0 && <p className="mt-2 font-label text-[10px] text-muted">{t('board.sheet.linked', { count: linked })}</p>}
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
  const t = useT()
  return (
    <div className="w-250 bg-white font-sans text-base text-ink">
      <header data-sheet-block className="relative overflow-hidden border-b-2 border-ink">
        <div aria-hidden="true" className="dither-primary absolute inset-0 opacity-20" />
        <div className="relative flex items-center justify-between gap-6 px-12 py-6">
          <span className="flex items-center gap-3 font-pixel text-2xl font-bold">
            <PixelLogo className="size-9" />
            <span>Glitch Lab</span>
          </span>
          <span className="border-2 border-ink bg-white px-2.5 py-1.5 font-label text-[10px] text-ink shadow-pixel">{t('board.sheet.exported', { date })}</span>
        </div>
      </header>

      <main className="px-12 pt-10 pb-12">
        <div data-sheet-block className="flex items-end justify-between gap-8">
          <div>
            <p className="font-label text-xs text-secondary">{t('board.sheet.prompt')}</p>
            <h1 className="mt-3 font-pixel text-[44px] leading-[1.1] font-bold text-ink">{t('board.sheet.title')}</h1>
            <p className="mt-2 text-muted">{t('board.sheet.lead')}</p>
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
          {t('board.sheet.madeWith')}
        </span>
        <span>{t('board.sheet.tagline')}</span>
      </footer>
    </div>
  )
}
