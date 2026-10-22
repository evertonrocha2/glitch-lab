import { Link } from 'react-router'
import { conceptLabel } from '../../../shared/concepts.js'
import { splitError } from '../../lib/caseInfo.js'

const STRIPE = { new: 'bg-muted', training: 'bg-secondary', solved: 'bg-primary' }
const STATUS = { new: 'New', training: 'Training', solved: 'Solved' }

// A case from the board, embedded in a note.
export default function CaseBlock({ item }) {
  if (!item) {
    return <p className="border-2 border-dashed border-line px-3 py-2.5 text-sm text-muted">This case is not on your board anymore.</p>
  }
  const { type, message } = splitError(item.error)
  return (
    <div className="flex overflow-hidden border-2 border-ink bg-white shadow-pixel-muted">
      <span aria-hidden="true" className={`w-1.5 shrink-0 ${STRIPE[item.status]}`} />
      <div className="min-w-0 flex-1 px-3 py-2.5">
        <p className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="bg-primary-soft px-1.5 py-0.5 font-semibold text-primary">{conceptLabel(item.concept)}</span>
          <span className="border border-line px-1.5 py-0.5 font-mono text-muted">{item.language}</span>
          <span className="text-muted">
            {STATUS[item.status]} · {Math.min(item.passedCount, 2)}/2
          </span>
        </p>
        <p className="mt-1.5 truncate font-pixel text-lg font-bold leading-tight text-ink">{type}</p>
        <p className="truncate font-mono text-xs text-ink/75">{message}</p>
      </div>
      <Link
        to={`/board?case=${encodeURIComponent(item.id)}`}
        className="self-stretch border-l-2 border-ink px-3 font-label text-[10px] text-ink transition-colors hover:bg-primary hover:text-white grid place-items-center"
        aria-label={`Open ${type} on the board`}
      >
        Open
      </Link>
    </div>
  )
}
