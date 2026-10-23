import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { COMMUNITY_LIMITS, parseTags, tagProblem } from '../../../shared/community.js'
import { DEFAULT_REQUIREMENTS, EVENT_KINDS, EVENT_LIMITS, eventStatus, LINK_KINDS, REQUIREMENT_LEVELS, requirementAllowed } from '../../../shared/events.js'
import CommunityShell from '../../components/community/CommunityShell.jsx'
import ErrorNotice from '../../components/ErrorNotice.jsx'
import PixelButton from '../../components/pixel/PixelButton.jsx'
import PixelCard from '../../components/pixel/PixelCard.jsx'
import { AuthError, createEvent, getEvent, updateEvent } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/AuthProvider.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

const INPUT = 'w-full border-2 border-ink bg-white px-3 py-2.5 text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel'
const LABEL = 'font-label text-xs text-ink'
const HOUR = 3_600_000

// <input type="datetime-local"> speaks the visitor's local time without a zone: "2026-10-22T14:00".
const pad = (value) => String(value).padStart(2, '0')
export function toLocalInput(iso) {
  const date = new Date(iso)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const fromLocalInput = (value) => {
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

// A new event starts at the next full hour and runs a week.
function emptyDraft() {
  const start = Math.ceil(Date.now() / HOUR) * HOUR
  return {
    title: '',
    summary: '',
    kind: 'hackathon',
    tags: '',
    startsAt: toLocalInput(start),
    endsAt: toLocalInput(start + 7 * 24 * HOUR),
    description: '',
    rules: '',
    prizes: '',
    requirements: { ...DEFAULT_REQUIREMENTS },
  }
}

function Counter({ value, max }) {
  return (
    <span className={`font-label text-[10px] ${value > max ? 'text-primary' : 'text-muted'}`}>
      {value}/{max}
    </span>
  )
}

function Field({ id, label, value, max, children }) {
  return (
    <div className="mt-6 first:mt-0">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
        {max && <Counter value={value.length} max={max} />}
      </div>
      {children}
    </div>
  )
}

// Required / Optional / Off for one kind of link (the repository can't be turned off).
function RequirementPicker({ kind, value, onChange }) {
  const t = useT()
  return (
    <div>
      <span id={`req-${kind}`} className="text-sm text-ink">
        {t(`events.req.${kind}`)}
      </span>
      <div role="group" aria-labelledby={`req-${kind}`} className="mt-1.5 flex border-2 border-ink bg-white">
        {REQUIREMENT_LEVELS.filter((level) => requirementAllowed(kind, level)).map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={value === level}
            onClick={() => onChange(level)}
            className={`flex-1 px-2 py-1.5 font-label text-[10px] ${value === level ? 'bg-secondary text-white' : 'text-ink hover:bg-mist'}`}
          >
            {t(`events.editor.level.${level}`)}
          </button>
        ))}
      </div>
    </div>
  )
}

// Create an event (/events/new) or edit one of yours before it starts (/events/:id/edit).
export default function EventEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const t = useT()
  const { user, getToken, signOut } = useAuth()
  const [draft, setDraft] = useState(emptyDraft)
  const [status, setStatus] = useState(id ? 'loading' : 'ready')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return undefined
    let live = true
    ;(async () => {
      try {
        const { event } = await getEvent(id, await getToken())
        if (!live) return
        if (!event.mine) return setStatus('forbidden')
        if (eventStatus(event) !== 'upcoming') return setStatus('started')
        setDraft({
          title: event.title,
          summary: event.summary,
          kind: event.kind,
          tags: event.tags.join(', '),
          startsAt: toLocalInput(event.startsAt),
          endsAt: toLocalInput(event.endsAt),
          description: event.description,
          rules: event.rules,
          prizes: event.prizes,
          requirements: event.requirements,
        })
        setStatus('ready')
      } catch (err) {
        if (!live) return
        if (err instanceof AuthError) await signOut()
        else {
          setStatus('error')
          setMessage(err.message)
        }
      }
    })()
    return () => {
      live = false
    }
  }, [id, getToken, signOut])

  const set = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }))
  const setRequirement = (kind) => (level) => setDraft((current) => ({ ...current, requirements: { ...current.requirements, [kind]: level } }))
  const tags = parseTags(draft.tags)
  const tagsBad = tags.length > COMMUNITY_LIMITS.tags || tags.some((tag) => tagProblem(tag))
  const startsAt = fromLocalInput(draft.startsAt)
  const endsAt = fromLocalInput(draft.endsAt)
  const datesBad = startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)
  const filled = draft.title.trim() && draft.summary.trim() && draft.description.trim() && startsAt && endsAt
  const canSave = Boolean(filled && !tagsBad && !datesBad && !saving && !user?.isDemo)

  async function save(event) {
    event.preventDefault()
    if (!canSave) return
    setSaving(true)
    setMessage('')
    const fields = {
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      kind: draft.kind,
      tags,
      startsAt,
      endsAt,
      description: draft.description.trim(),
      rules: draft.rules.trim(),
      prizes: draft.prizes.trim(),
      requirements: draft.requirements,
    }
    try {
      const token = await getToken()
      const saved = id ? await updateEvent(id, fields, token) : await createEvent(fields, token)
      navigate(`/events/${saved.event.id}`)
    } catch (err) {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
      setSaving(false)
    }
  }

  return (
    <CommunityShell>
      <Link to={id ? `/events/${id}` : '/events'} className="font-label text-xs text-ink hover:text-primary">
        &lt; {id ? t('events.editor.back') : t('events.page.all')}
      </Link>
      <p className="mt-6 font-label text-xs text-secondary">
        &gt; {id ? t('events.editor.promptEdit') : t('events.editor.promptNew')}
        <span className="motion-safe:animate-caret">_</span>
      </p>
      <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">{id ? t('events.editor.titleEdit') : t('events.editor.titleNew')}</h1>
      <p className="mt-2 max-w-xl text-muted">{t('events.editor.lede')}</p>

      {status === 'loading' && (
        <p role="status" className="mt-8 font-label text-xs text-muted">
          {t('events.editor.loading')}
        </p>
      )}
      {(status === 'forbidden' || status === 'started') && (
        <p className="mt-8 border-2 border-dashed border-ink/40 p-6 text-muted">{t(`events.editor.${status}`)}</p>
      )}
      {status === 'error' && (
        <div className="mt-8">
          <ErrorNotice message={message} />
        </div>
      )}

      {status === 'ready' && (
        <form onSubmit={save} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <PixelCard className="min-w-0 p-5 sm:p-7">
            {user?.isDemo && <p className="mb-5 border-2 border-ink bg-secondary-soft p-3 text-sm text-ink">{t('events.editor.demo')}</p>}
            <Field id="event-title" label={t('events.editor.title')} value={draft.title} max={EVENT_LIMITS.title}>
              <input
                id="event-title"
                value={draft.title}
                onChange={set('title')}
                maxLength={EVENT_LIMITS.title}
                placeholder={t('events.editor.titlePlaceholder')}
                className={`mt-2 font-pixel text-xl ${INPUT}`}
              />
            </Field>
            <Field id="event-summary" label={t('events.editor.summary')} value={draft.summary} max={EVENT_LIMITS.summary}>
              <input id="event-summary" value={draft.summary} onChange={set('summary')} maxLength={EVENT_LIMITS.summary} placeholder={t('events.editor.summaryPlaceholder')} className={`mt-2 ${INPUT}`} />
            </Field>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="event-starts" className={LABEL}>
                  {t('events.editor.starts')}
                </label>
                <input id="event-starts" type="datetime-local" value={draft.startsAt} onChange={set('startsAt')} className={`mt-2 ${INPUT}`} />
              </div>
              <div>
                <label htmlFor="event-ends" className={LABEL}>
                  {t('events.editor.ends')}
                </label>
                <input id="event-ends" type="datetime-local" value={draft.endsAt} onChange={set('endsAt')} className={`mt-2 ${INPUT}`} />
              </div>
            </div>
            <p className={`mt-1.5 text-xs ${datesBad ? 'text-primary' : 'text-muted'}`}>{datesBad ? t('events.editor.endBeforeStart') : t('events.editor.datesHint')}</p>
            <Field id="event-description" label={t('events.editor.description')} value={draft.description} max={EVENT_LIMITS.description}>
              <textarea
                id="event-description"
                value={draft.description}
                onChange={set('description')}
                maxLength={EVENT_LIMITS.description}
                rows={8}
                placeholder={t('events.editor.descriptionPlaceholder')}
                className={`mt-2 block resize-y text-sm leading-relaxed ${INPUT}`}
              />
            </Field>
            <Field id="event-rules" label={t('events.editor.rules')} value={draft.rules} max={EVENT_LIMITS.rules}>
              <textarea
                id="event-rules"
                value={draft.rules}
                onChange={set('rules')}
                maxLength={EVENT_LIMITS.rules}
                rows={5}
                placeholder={t('events.editor.rulesPlaceholder')}
                className={`mt-2 block resize-y text-sm leading-relaxed ${INPUT}`}
              />
            </Field>
            <Field id="event-prizes" label={t('events.editor.prizes')} value={draft.prizes} max={EVENT_LIMITS.prizes}>
              <textarea
                id="event-prizes"
                value={draft.prizes}
                onChange={set('prizes')}
                maxLength={EVENT_LIMITS.prizes}
                rows={2}
                placeholder={t('events.editor.prizesPlaceholder')}
                className={`mt-2 block resize-y text-sm ${INPUT}`}
              />
            </Field>
          </PixelCard>

          <div className="space-y-5">
            <PixelCard tone="secondary" className="p-5">
              <label htmlFor="event-kind" className={LABEL}>
                {t('events.editor.kind')}
              </label>
              <select id="event-kind" value={draft.kind} onChange={set('kind')} className={`mt-2 text-sm ${INPUT}`}>
                {EVENT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`events.kind.${kind}`)}
                  </option>
                ))}
              </select>
              <label htmlFor="event-tags" className={`mt-5 block ${LABEL}`}>
                {t('events.editor.tags')}
              </label>
              <input id="event-tags" value={draft.tags} onChange={set('tags')} placeholder={t('events.editor.tagsPlaceholder')} className={`mt-2 font-mono text-sm ${INPUT}`} />
              <p className={`mt-1.5 text-xs ${tagsBad ? 'text-primary' : 'text-muted'}`}>{t('events.editor.tagsHint', { max: COMMUNITY_LIMITS.tags })}</p>
            </PixelCard>

            <PixelCard tone="secondary" className="p-5">
              <p className={LABEL}>{t('events.editor.requirements')}</p>
              <div className="mt-3 space-y-3">
                {LINK_KINDS.map((kind) => (
                  <RequirementPicker key={kind} kind={kind} value={draft.requirements[kind]} onChange={setRequirement(kind)} />
                ))}
              </div>
            </PixelCard>

            {message && <ErrorNotice message={message} />}
            <PixelButton type="submit" disabled={!canSave} className="w-full py-3">
              {saving ? t('events.editor.saving') : id ? t('events.editor.save') : t('events.editor.create')}
            </PixelButton>
          </div>
        </form>
      )}
    </CommunityShell>
  )
}
