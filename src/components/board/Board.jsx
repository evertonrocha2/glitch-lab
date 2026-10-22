import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../lib/i18n/labels.js'
import StepIcon from '../landing/StepIcon.jsx'
import CaseCard from './CaseCard.jsx'

// Gray = just investigated, blue = practicing, purple = understood for good.
const COLUMNS = [
  {
    status: 'new',
    icon: 'investigate',
    head: 'bg-mist',
    tone: 'text-ink',
    shadow: 'shadow-pixel-muted',
  },
  {
    status: 'training',
    icon: 'gym',
    head: 'bg-secondary-soft',
    tone: 'text-secondary',
    shadow: 'shadow-pixel-secondary',
  },
  {
    status: 'solved',
    icon: 'solved',
    head: 'bg-primary-soft',
    tone: 'text-primary',
    shadow: 'shadow-pixel',
  },
]

export default function Board({ cases, onOpen }) {
  const t = useT()
  const labels = useLabels()
  return (
    <div className="grid items-start gap-6 md:grid-cols-3">
      {COLUMNS.map((column) => {
        const items = cases.filter((item) => item.status === column.status)
        return (
          <section
            key={column.status}
            aria-labelledby={`column-${column.status}`}
            className={`border-2 border-ink bg-white ${column.shadow}`}
          >
            <header className={`flex items-start justify-between gap-3 border-b-2 border-ink px-4 py-3 ${column.head}`}>
              <div>
                <h2 id={`column-${column.status}`} className={`flex items-center gap-2 font-label text-sm ${column.tone}`}>
                  <StepIcon kind={column.icon} className="h-4 w-auto" />
                  {labels.status(column.status)}
                </h2>
                <p className="mt-1 text-sm text-muted">{t(`board.column.${column.status}.hint`)}</p>
              </div>
              <span className="min-w-11 border-2 border-ink bg-white px-1.5 text-center font-label text-lg leading-8 text-ink">
                {String(items.length).padStart(2, '0')}
              </span>
            </header>
            {items.length > 0 ? (
              <ul className="space-y-3 p-3">
                {items.map((item) => (
                  <li key={item.id}>
                    <CaseCard item={item} onOpen={onOpen} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-muted">{t(`board.column.${column.status}.empty`)}</p>
            )}
          </section>
        )
      })}
    </div>
  )
}
