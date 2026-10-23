import { timeline } from '../../../shared/interrogation.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

const STYLE = {
  passed: 'bg-secondary text-white',
  current: 'bg-primary text-white shadow-pixel-ink',
  locked: 'bg-white text-muted',
}

// The six steps in a row (two rows of three on a phone): done in blue, the current one in purple.
export default function InterrogationStepper({ interrogation }) {
  const t = useT()
  const rows = timeline(interrogation)
  return (
    <ol aria-label={t('interrogation.page.steps')} className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {rows.map((row) => {
        const title = t(`interrogation.step.${row.id}.title`)
        const status = t(`interrogation.step.status.${row.status}`)
        return (
          <li
            key={row.id}
            aria-current={row.status === 'current' ? 'step' : undefined}
            className={`flex min-h-14 flex-col justify-between gap-1 border-2 border-ink px-2 py-1.5 ${STYLE[row.status]}`}
          >
            <span aria-hidden="true" className="font-label text-[10px]">
              {row.index + 1}
            </span>
            <span aria-hidden="true" className="font-label text-[10px] leading-tight">
              {title}
            </span>
            <span className="sr-only">{t('interrogation.step.label', { number: row.index + 1, title, status })}</span>
          </li>
        )
      })}
    </ol>
  )
}
