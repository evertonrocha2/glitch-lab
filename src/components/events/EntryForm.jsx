import { useState } from 'react'
import { EVENT_LIMITS } from '../../../shared/events.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../pixel/PixelButton.jsx'
import PixelCard from '../pixel/PixelCard.jsx'

const INPUT = 'w-full border-2 border-ink bg-white px-3 py-2.5 text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel'
const LABEL = 'font-label text-xs text-ink'
const LINKS = [
  { kind: 'repo', field: 'repoUrl', placeholder: 'https://github.com/you/project' },
  { kind: 'video', field: 'videoUrl', placeholder: 'https://youtu.be/...' },
  { kind: 'demo', field: 'demoUrl', placeholder: 'https://your-demo.dev' },
]

// Send or edit your entry. Only the links the event asks for show up. The server checks every link;
// the form only stops a send with a required field left empty.
export default function EntryForm({ requirements, entry, onSave, onCancel }) {
  const t = useT()
  const [draft, setDraft] = useState(() => ({
    title: entry?.title ?? '',
    description: entry?.description ?? '',
    repoUrl: entry?.repoUrl ?? '',
    videoUrl: entry?.videoUrl ?? '',
    demoUrl: entry?.demoUrl ?? '',
  }))
  const [busy, setBusy] = useState(false)
  const set = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }))
  const links = LINKS.filter(({ kind }) => requirements[kind] !== 'off')
  const missing = !draft.title.trim() || links.some(({ kind, field }) => requirements[kind] === 'required' && !draft[field].trim())

  async function submit(event) {
    event.preventDefault()
    if (missing || busy) return
    setBusy(true)
    const fields = { title: draft.title.trim(), description: draft.description.trim() }
    for (const { field } of links) fields[field] = draft[field].trim()
    const saved = await onSave(fields)
    if (!saved) setBusy(false)
  }

  return (
    <PixelCard as="form" tone="secondary" onSubmit={submit} aria-label={entry ? t('events.page.editEntry') : t('events.page.join')} className="p-5 sm:p-6">
      <h3 className="font-pixel text-xl font-bold text-ink">{entry ? t('events.page.editEntry') : t('events.page.join')}</h3>
      <label htmlFor="entry-title" className={`mt-4 block ${LABEL}`}>
        {t('events.entry.title')}
      </label>
      <input id="entry-title" value={draft.title} onChange={set('title')} maxLength={EVENT_LIMITS.entryTitle} placeholder={t('events.entry.titlePlaceholder')} className={`mt-2 ${INPUT}`} />

      <label htmlFor="entry-description" className={`mt-4 block ${LABEL}`}>
        {t('events.entry.description')} <span className="text-muted">{t('events.entry.optional')}</span>
      </label>
      <textarea
        id="entry-description"
        value={draft.description}
        onChange={set('description')}
        maxLength={EVENT_LIMITS.entryDescription}
        rows={4}
        placeholder={t('events.entry.descriptionPlaceholder')}
        className={`mt-2 block resize-y ${INPUT}`}
      />

      {links.map(({ kind, field, placeholder }) => (
        <div key={field} className="mt-4">
          <label htmlFor={`entry-${kind}`} className={`block ${LABEL}`}>
            {t(`events.entry.${kind}`)} {requirements[kind] === 'optional' && <span className="text-muted">{t('events.entry.optional')}</span>}
          </label>
          <input
            id={`entry-${kind}`}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={draft[field]}
            onChange={set(field)}
            maxLength={EVENT_LIMITS.url}
            placeholder={placeholder}
            className={`mt-2 font-mono text-sm ${INPUT}`}
          />
          <p className="mt-1 text-xs text-muted">{t(`events.entry.${kind}Hint`)}</p>
        </div>
      ))}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {onCancel && (
          <PixelButton variant="ghost" onClick={onCancel}>
            {t('events.entry.cancel')}
          </PixelButton>
        )}
        <PixelButton type="submit" disabled={missing || busy}>
          {busy ? t('events.entry.sending') : entry ? t('events.entry.save') : t('events.entry.submit')}
        </PixelButton>
      </div>
    </PixelCard>
  )
}
