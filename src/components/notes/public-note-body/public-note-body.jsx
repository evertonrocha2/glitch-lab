import { CONCEPTS } from '../../../../shared/concepts.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { conceptName, statusName } from '../../../lib/i18n/labels.js'
import InlineText from '../inline-text/inline-text.jsx'
import RichBlocks, { groupBlocks } from '../rich-blocks/rich-blocks.jsx'

const STRIPE = { new: 'bg-muted', training: 'bg-secondary', solved: 'bg-primary' }

// The API sends the bug type's English label; name it in the reader's language when it is a known one.
function bugTypeName(t, label) {
  const concept = CONCEPTS.find((item) => item.label === label)
  return concept ? conceptName(t, concept.id) : label
}

function Check({ done }) {
  return (
    <span aria-hidden="true" className={`mt-0.5 grid size-5 shrink-0 place-items-center border-2 border-ink ${done ? 'bg-primary' : 'bg-white'}`}>
      {done && <span className="size-2 bg-white" />}
    </span>
  )
}

// Only what the API shares about a case: the kind of error, the bug type, language and status. No code.
function CaseSummary({ summary }) {
  const t = useT()
  if (!summary) return <p className="border-2 border-dashed border-line px-4 py-3 text-sm text-muted">{t('landing.note.privateCase')}</p>
  return (
    <figure aria-label={t('landing.note.case', { type: summary.errorType })} className="flex border-2 border-ink bg-white shadow-pixel-muted">
      <span aria-hidden="true" className={`w-2 shrink-0 ${STRIPE[summary.status] ?? STRIPE.new}`} />
      <div className="min-w-0 flex-1 px-4 py-3">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          {/* A question card names its topic where an error names its type. */}
          {summary.kind === 'question' && <span className="border border-ink bg-secondary px-1.5 py-0.5 font-label text-[10px] leading-4 text-white">{t('question.badge')}</span>}
          <span className="bg-primary-soft px-1.5 py-0.5 font-semibold text-primary">{bugTypeName(t, summary.bugType)}</span>
          <span className="border border-line px-1.5 py-0.5 font-mono text-muted">{summary.language}</span>
          <span className="text-muted">{statusName(t, summary.status)}</span>
        </p>
        <p className="mt-2 font-pixel text-xl leading-tight font-bold wrap-break-word text-ink">{summary.errorType}</p>
        {summary.message && <p className={`mt-1 text-sm leading-snug wrap-break-word text-ink/75 ${summary.kind === 'question' ? '' : 'font-mono'}`}>{summary.message}</p>}
      </div>
    </figure>
  )
}

function Todos({ items }) {
  const t = useT()
  return (
    <ul aria-label={t('landing.note.todos')} className="space-y-2 py-1">
      {items.map((todo) => (
        <li key={todo.id} className="flex items-start gap-3">
          <Check done={todo.done} />
          <span className={`leading-relaxed wrap-break-word ${todo.done ? 'text-muted line-through' : 'text-ink'}`}>
            <InlineText text={todo.text} />
          </span>
          {todo.done && <span className="sr-only">{t('landing.note.done')}</span>}
        </li>
      ))}
    </ul>
  )
}

// A shared note, read-only: the blocks the API sends for a public note, with no edit controls.
export default function PublicNoteBody({ blocks }) {
  const t = useT()
  if (!groupBlocks(blocks).length) return <p className="text-muted">{t('landing.note.empty')}</p>
  return (
    <div className="space-y-3">
      <RichBlocks blocks={blocks} renderTodos={(items) => <Todos items={items} />} renderCase={(block) => <CaseSummary summary={block.case} />} />
    </div>
  )
}
