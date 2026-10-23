import { useState } from 'react'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import ReportDialog from '../report-dialog/report-dialog.jsx'

// Small text buttons under a message. The visible text stays small; the invisible ::before
// grows each one to a 40px tap target. On a mouse they show on hover or focus, on touch always.
const ACTION =
  'relative font-label text-[10px] text-muted underline-offset-2 before:absolute before:-inset-x-2 before:-inset-y-3 hover:text-primary hover:underline focus-visible:text-primary focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 [@media(hover:none)]:opacity-100'

// canReport: someone else's message and I may report. onDelete: given when I may delete it.
export default function MessageActions({ kind, message, canReport, onDelete }) {
  const t = useT()
  const [reporting, setReporting] = useState(false)
  if (!canReport && !onDelete) return null
  return (
    <>
      {canReport && (
        <button type="button" onClick={() => setReporting(true)} aria-label={t('chat.actions.reportSr', { name: message.sender.name })} className={ACTION}>
          {t('chat.actions.report')}
        </button>
      )}
      {onDelete && (
        <button type="button" onClick={() => onDelete(message)} aria-label={t('chat.actions.deleteSr')} className={ACTION}>
          {t('chat.actions.delete')}
        </button>
      )}
      {reporting && <ReportDialog kind={kind} message={message} onClose={() => setReporting(false)} />}
    </>
  )
}
