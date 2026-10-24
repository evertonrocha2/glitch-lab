import { useId, useState } from 'react'
import { STUDY_LOG, cleanTopic } from '../../../../shared/study-log.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import LinkPicker from '../link-picker/link-picker.jsx'

// "What are you studying?" with an optional case or note: the timer's start and edit forms, and a
// session's edit form on /study. The draft lives here, so typing never re-renders the page around it.
// onSubmit gets { topic, caseId, noteId }; when it throws, its message shows under the field.
export default function TopicForm({ initial, label, submitLabel, submitAria, onSubmit, onCancel, required = false, options, autoFocus = true, className = '' }) {
  const t = useT()
  const id = useId()
  const [topic, setTopic] = useState(initial?.topic ?? '')
  const [link, setLink] = useState({ caseId: initial?.caseId ?? null, noteId: initial?.noteId ?? null })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    const clean = cleanTopic(topic)
    if (required && !clean) {
      setError(t('server.studyTopicMissing'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSubmit({ topic: clean, ...link })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} onKeyDown={(event) => event.key === 'Escape' && onCancel?.()} className={`space-y-2 ${className}`}>
      <label htmlFor={`${id}-topic`} className="block font-label text-[10px] text-secondary">
        {label ?? t('study.topic.label')}
        {!required && <span className="text-muted"> · {t('study.topic.optional')}</span>}
      </label>
      <input
        id={`${id}-topic`}
        value={topic}
        onChange={(event) => setTopic(event.target.value)}
        maxLength={STUDY_LOG.topic}
        placeholder={t('study.topic.placeholder')}
        // biome-ignore lint/a11y/noAutofocus: the form opens on purpose, to type into
        autoFocus={autoFocus}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="block min-h-10 w-full border-2 border-ink bg-white px-3 text-sm text-ink outline-none placeholder:text-muted focus-visible:shadow-pixel-secondary"
      />
      <LinkPicker value={link} onChange={setLink} options={options} />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-primary">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <PixelButton type="submit" disabled={busy} aria-label={submitAria} className="px-3 py-2">
          {submitLabel}
        </PixelButton>
        {onCancel && (
          <PixelButton variant="ghost" onClick={onCancel} className="px-3 py-2">
            {t('study.cancel')}
          </PixelButton>
        )}
      </div>
    </form>
  )
}
