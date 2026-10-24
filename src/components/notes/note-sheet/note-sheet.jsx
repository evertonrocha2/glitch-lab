import { isQuestion } from '../../../../shared/question.js'
import { caseHeading } from '../../../lib/case-info.js'
import QuestionBadge from '../../board/question-badge/question-badge.jsx'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../../lib/i18n/labels.js'
import PixelLogo from '../../ui/pixel-logo/pixel-logo.jsx'
import InlineText from '../inline-text/inline-text.jsx'
import NoteTags from '../note-tags/note-tags.jsx'
import RichBlocks from '../rich-blocks/rich-blocks.jsx'

const STRIPE = { new: 'bg-muted', training: 'bg-secondary', solved: 'bg-primary' }

function summary(blocks, t) {
  const cases = blocks.filter((block) => block.type === 'case').length
  const todos = blocks.filter((block) => block.type === 'todo')
  const parts = []
  if (cases) parts.push(t('notes.cases', { count: cases }))
  if (todos.length) parts.push(t('notes.sheet.todos', { done: todos.filter((todo) => todo.done).length, count: todos.length }))
  return parts.join(' · ')
}

function PixelCheck({ done }) {
  return (
    <span className={`mt-0.5 grid size-5 shrink-0 place-items-center border-2 border-ink ${done ? 'bg-primary' : 'bg-white'}`}>
      {done && (
        <svg aria-hidden="true" viewBox="0 0 7 7" shapeRendering="crispEdges" className="size-3 fill-white">
          <rect x="0" y="3" width="1" height="2" />
          <rect x="1" y="4" width="1" height="2" />
          <rect x="2" y="5" width="1" height="2" />
          <rect x="3" y="4" width="1" height="2" />
          <rect x="4" y="2" width="1" height="2" />
          <rect x="5" y="1" width="1" height="2" />
          <rect x="6" y="0" width="1" height="2" />
        </svg>
      )}
    </span>
  )
}

// The same card as CaseBlock in the editor, but nothing to click and the whole error shows.
function SheetCase({ item }) {
  const t = useT()
  const labels = useLabels()
  if (!item) {
    return <p className="border-2 border-dashed border-line px-4 py-3 text-sm text-muted">{t('notes.case.gone')}</p>
  }
  const { type, message } = caseHeading(item)
  const question = isQuestion(item)
  const passed = Math.min(item.passedCount, 2)
  return (
    <div className="flex border-2 border-ink bg-white shadow-pixel-muted">
      <span aria-hidden="true" className={`w-2 shrink-0 ${STRIPE[item.status]}`} />
      <div className="min-w-0 flex-1 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {question && <QuestionBadge topic={item.topic} />}
          <span className="bg-primary-soft px-1.5 py-0.5 font-semibold text-primary">{labels.concept(item.concept)}</span>
          <span className="border border-line px-1.5 py-0.5 font-mono text-muted">{item.language}</span>
          <span className="text-muted">
            {labels.status(item.status)} · {passed}/2
          </span>
          <span aria-hidden="true" className="ml-auto flex gap-1">
            {[0, 1].map((step) => (
              <span key={step} className={`size-2.5 border-2 border-ink ${step < passed ? 'bg-secondary' : 'bg-white'}`} />
            ))}
          </span>
        </div>
        <p className="mt-2 font-pixel text-xl leading-tight font-bold wrap-break-word text-ink">{type}</p>
        {message && <p className={`mt-1 text-sm leading-snug wrap-break-word text-ink/75 ${question ? '' : 'font-mono'}`}>{message}</p>}
      </div>
    </div>
  )
}

function SheetTodos({ items }) {
  return (
    <ul className="space-y-2 py-1">
      {items.map((todo) => (
        <li key={todo.id} data-sheet-block data-done={String(todo.done)} className="flex items-start gap-3">
          <PixelCheck done={todo.done} />
          <span className={`leading-relaxed wrap-break-word ${todo.done ? 'text-muted line-through' : 'text-ink'}`}>
            <InlineText text={todo.text} />
          </span>
        </li>
      ))}
    </ul>
  )
}

// A print-ready picture of a note, for the PNG and PDF exports: fixed width, white, Pixel Lab look.
export default function NoteSheet({ note, cases, date }) {
  const t = useT()
  const casesById = new Map(cases.map((item) => [item.id, item]))
  const line = summary(note.blocks, t)
  return (
    <div className="w-200 bg-white font-sans text-base text-ink">
      <header className="relative overflow-hidden border-b-2 border-ink">
        <div aria-hidden="true" className="dither-primary absolute inset-0 opacity-20" />
        <div className="relative flex items-center justify-between gap-6 px-14 py-6">
          <span className="flex shrink-0 items-center gap-3 font-pixel text-2xl font-bold whitespace-nowrap">
            <PixelLogo className="size-9" />
            <span>Glitch Lab</span>
          </span>
          <span className="shrink-0 border-2 border-ink bg-white px-2.5 py-1.5 font-label text-[10px] whitespace-nowrap text-ink shadow-pixel">{t('notes.sheet.exported', { date })}</span>
        </div>
      </header>

      <main className="px-14 pt-11 pb-12">
        <p className="font-label text-xs text-secondary">&gt; {t('notes.sheet.prompt')}_</p>
        <h1 className="mt-3 font-pixel text-[44px] leading-[1.1] font-bold wrap-break-word text-ink">{note.title || t('notes.untitled')}</h1>
        <NoteTags tags={note.tags} large className="mt-4" />
        {line && <p className="mt-3 font-label text-[10px] text-muted">{line}</p>}
        <div aria-hidden="true" className="mt-7 mb-6 h-0.5 bg-ink" />
        <div className="space-y-3">
          <RichBlocks
            blocks={note.blocks}
            variant="sheet"
            renderTodos={(items) => <SheetTodos items={items} />}
            renderCase={(block) => <SheetCase item={casesById.get(block.caseId)} />}
          />
        </div>
      </main>

      <footer className="mx-14 flex items-center justify-between gap-6 border-t-2 border-dashed border-line py-6 font-label text-[10px] text-muted">
        <span className="flex items-center gap-2">
          <PixelLogo className="size-4" />
          {t('notes.sheet.madeWith')}
        </span>
        <span>{t('notes.sheet.tagline')}</span>
      </footer>
    </div>
  )
}
