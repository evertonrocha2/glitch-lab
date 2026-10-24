import { useState } from 'react'
import { Link } from 'react-router'
import { deleteStudySession, updateStudySession } from '../../../lib/api.js'
import { useAuth } from '../../../lib/auth/auth-provider.jsx'
import { formatDuration } from '../../../lib/day.js'
import { useI18n, useT } from '../../../lib/i18n/I18nProvider.jsx'
import { linkLabel } from '../../../lib/study/link-options.js'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import TopicForm from '../topic-form/topic-form.jsx'

const timeOf = (iso, locale) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

// "14:05–14:50", "14:05–now" for a run still going, or nothing for a session logged without a time.
function TimeRange({ session }) {
  const { locale } = useI18n()
  const t = useT()
  if (session.source === 'manual' && !session.endedAt) return <span className="text-muted">{t('study.row.noTime')}</span>
  const end = session.endedAt ? timeOf(session.endedAt, locale) : t('study.row.now')
  return (
    <span className="tabular-nums">
      {timeOf(session.startedAt, locale)}–{end}
    </span>
  )
}

const CHIP = 'inline-flex min-h-10 max-w-full items-center gap-1.5 border-2 border-ink bg-white px-2 text-xs text-ink hover:bg-secondary-soft'

// One session in the log: when, how long, what, its case or note, and edit and delete.
export default function SessionRow({ session, options, onSaved, onDeleted, onError }) {
  const t = useT()
  const { getToken } = useAuth()
  const [mode, setMode] = useState(null)
  const [busy, setBusy] = useState(false)
  const manual = session.source === 'manual'
  const caseText = session.caseId ? (linkLabel(options, 'case', session.caseId) ?? t('study.link.caseLinked')) : null
  const noteText = session.noteId ? (linkLabel(options, 'note', session.noteId) ?? t('study.link.noteLinked')) : null

  async function save(fields) {
    const updated = await updateStudySession(session.id, fields, await getToken())
    onSaved(updated)
    setMode(null)
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteStudySession(session.id, await getToken())
      onDeleted(session.id)
    } catch (err) {
      setBusy(false)
      setMode(null)
      onError(err)
    }
  }

  return (
    <li className="border-2 border-ink bg-white px-3 py-2.5 sm:px-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-label text-xs text-secondary">
          <TimeRange session={session} />
        </span>
        <strong className="font-pixel text-sm text-ink tabular-nums">{formatDuration(session.seconds)}</strong>
        {manual && <span className="border border-ink bg-primary-soft px-1.5 py-0.5 font-label text-[10px] leading-none text-primary">{t('study.row.manual')}</span>}
        {!manual && !session.endedAt && <span className="font-label text-[10px] text-primary">{t('study.row.running')}</span>}
      </div>

      {mode === 'edit' ? (
        <TopicForm
          className="mt-3"
          initial={session}
          label={t('study.row.topicLabel')}
          required={manual}
          options={options}
          submitLabel={t('study.save')}
          onSubmit={save}
          onCancel={() => setMode(null)}
        />
      ) : (
        <>
          <p className={`mt-1 break-words ${session.topic ? 'text-ink' : 'text-muted'}`}>{session.topic || t('study.row.noTopic')}</p>
          {(caseText || noteText) && (
            <p className="mt-2 flex flex-wrap gap-2">
              {caseText && (
                <Link to={`/board?case=${encodeURIComponent(session.caseId)}`} className={CHIP}>
                  <span className="font-label text-[10px] text-secondary">{t('study.link.case')}</span>
                  <span className="truncate">{caseText}</span>
                </Link>
              )}
              {noteText && (
                <Link to={`/notes/${encodeURIComponent(session.noteId)}`} className={CHIP}>
                  <span className="font-label text-[10px] text-secondary">{t('study.link.note')}</span>
                  <span className="truncate">{noteText}</span>
                </Link>
              )}
            </p>
          )}
          {mode === 'delete' ? (
            <div className="mt-3 border-t-2 border-dashed border-line pt-3">
              <p className="text-sm text-ink">{t('study.row.deleteAsk')}</p>
              {!manual && <p className="mt-1 text-xs text-muted">{t('study.row.deleteKeepsTime')}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <PixelButton onClick={remove} disabled={busy} className="px-3 py-2">
                  {t('study.row.deleteConfirm')}
                </PixelButton>
                <PixelButton variant="ghost" onClick={() => setMode(null)} className="px-3 py-2">
                  {t('study.row.keep')}
                </PixelButton>
              </div>
            </div>
          ) : (
            <div className="mt-1 flex flex-wrap gap-x-1">
              <button
                type="button"
                onClick={() => setMode('edit')}
                aria-label={t('study.row.editLabel', { topic: session.topic || t('study.row.noTopic') })}
                className="min-h-10 px-1 font-label text-[10px] text-secondary hover:text-primary"
              >
                {t('study.row.edit')}
              </button>
              <button
                type="button"
                onClick={() => setMode('delete')}
                aria-label={t('study.row.deleteLabel', { topic: session.topic || t('study.row.noTopic') })}
                className="min-h-10 px-1 font-label text-[10px] text-muted hover:text-primary"
              >
                {t('study.row.delete')}
              </button>
            </div>
          )}
        </>
      )}
    </li>
  )
}
