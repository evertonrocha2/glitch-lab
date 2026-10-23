import { useEffect, useId, useRef, useState } from 'react'
import { MESSAGE_LIMITS, REPORT_REASONS } from '../../../../shared/messages.js'
import { reportMessage } from '../../../lib/api.js'
import { useAuth } from '../../../lib/auth/auth-provider.jsx'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'

// Reports one message for review: a reason, an optional note, then a thank you.
// kind: 'dm' or 'community'. onClose() when it's done or cancelled.
export default function ReportDialog({ kind, message, onClose }) {
  const t = useT()
  const { getToken } = useAuth()
  const id = useId()
  const [reason, setReason] = useState(null)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const panel = useRef(null)
  const opener = useRef(document.activeElement)
  const close = useRef(onClose)
  close.current = onClose

  // Focus moves into the dialog and goes back to the button that opened it; Escape closes it.
  useEffect(() => {
    panel.current?.querySelector('input, button')?.focus()
    const back = opener.current
    const onKey = (event) => event.key === 'Escape' && close.current()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      back?.focus?.()
    }
  }, [])

  async function submit(event) {
    event.preventDefault()
    if (!reason) return
    setStatus('sending')
    setError(null)
    try {
      await reportMessage({ kind, messageId: message.id, reason, note: note.trim() }, await getToken())
      setStatus('sent')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="w-full max-w-md border-2 border-ink bg-white p-5 shadow-pixel-ink">
        <h2 id={`${id}-title`} className="font-pixel text-xl font-bold text-ink">
          {t('chat.report.title')}
        </h2>
        {status === 'sent' ? (
          <>
            <p role="status" className="mt-3 text-sm text-ink">
              {t('chat.report.thanks')}
            </p>
            <div className="mt-5 flex justify-end">
              <PixelButton onClick={onClose}>{t('chat.report.close')}</PixelButton>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <blockquote className="mt-3 line-clamp-3 border-l-4 border-line pl-3 text-sm whitespace-pre-wrap wrap-break-word text-muted">{message.body}</blockquote>
            <fieldset className="mt-4">
              <legend className="font-label text-xs text-ink">{t('chat.report.reason')}</legend>
              <div className="mt-2 grid gap-1">
                {REPORT_REASONS.map((value) => (
                  <label key={value} className="flex min-h-10 cursor-pointer items-center gap-3 px-1 text-sm text-ink hover:bg-mist">
                    <input type="radio" name={`${id}-reason`} value={value} checked={reason === value} onChange={() => setReason(value)} className="size-4 accent-primary" />
                    {t(`chat.report.reasons.${value}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <label htmlFor={`${id}-note`} className="mt-4 block font-label text-xs text-ink">
              {t('chat.report.note')}
            </label>
            <textarea
              id={`${id}-note`}
              rows={2}
              value={note}
              maxLength={MESSAGE_LIMITS.reportNote}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('chat.report.notePlaceholder')}
              className="mt-2 w-full resize-none border-2 border-ink bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel"
            />
            {error && (
              <p role="alert" className="mt-3 border-2 border-ink bg-primary-soft px-3 py-2 text-sm text-ink">
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <PixelButton variant="ghost" onClick={onClose}>
                {t('chat.report.cancel')}
              </PixelButton>
              <PixelButton type="submit" disabled={!reason || status === 'sending'}>
                {status === 'sending' ? t('chat.report.sending') : t('chat.report.send')}
              </PixelButton>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
