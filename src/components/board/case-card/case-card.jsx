import { splitError } from '../../../lib/caseInfo.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../../../lib/i18n/format.js'
import { useLabels } from '../../../lib/i18n/labels.js'

export const firstLine = (text) => text.split('\n')[0]

// The stripe repeats the column color so a card is recognizable even out of its column.
const STRIPE = { new: 'bg-muted', training: 'bg-secondary', solved: 'bg-primary' }
const CHALLENGE_SLOTS = [1, 2]
const CHALLENGES_TO_SOLVE = CHALLENGE_SLOTS.length

export function ProgressBlocks({ passed }) {
  return (
    <span aria-hidden="true" className="flex gap-1">
      {CHALLENGE_SLOTS.map((slot) => (
        <span key={slot} className={`size-2.5 border border-ink ${slot <= passed ? 'bg-secondary' : 'bg-white'}`} />
      ))}
    </span>
  )
}

export default function CaseCard({ item, onOpen }) {
  const t = useT()
  const { since } = useFormat()
  const { type, message } = splitError(item.error)
  const concept = useLabels().concept(item.concept)

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={t('board.card.label', { error: firstLine(item.error), concept, language: item.language, passed: item.passedCount, total: CHALLENGES_TO_SOLVE })}
      className="flex w-full overflow-hidden border-2 border-ink bg-white text-left shadow-pixel-muted transition-[translate,box-shadow] duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-pixel"
    >
      <span aria-hidden="true" className={`w-1.5 shrink-0 ${STRIPE[item.status]}`} />
      <span className="min-w-0 flex-1 p-3.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary">{concept}</span>
          <span className="border border-line px-1.5 py-0.5 font-mono text-xs text-muted">{item.language}</span>
        </span>
        <span className="mt-2.5 block wrap-break-word font-pixel text-lg font-bold leading-tight text-ink">{type}</span>
        <span className="mt-1 line-clamp-2 block wrap-break-word font-mono text-sm leading-snug text-ink/75">{message}</span>
        <span className="mt-3 flex items-center justify-between gap-2 border-t-2 border-dashed border-line pt-2.5 text-xs text-muted">
          <span className="flex items-center gap-2">
            <ProgressBlocks passed={item.passedCount} />
            <span>{t('board.card.challenges', { passed: item.passedCount, total: CHALLENGES_TO_SOLVE })}</span>
          </span>
          <span>{since(item.createdAt)}</span>
        </span>
      </span>
    </button>
  )
}
