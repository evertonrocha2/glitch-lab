import { useId, useState } from 'react'
import { addDays, cleanTopic, STUDY_LOG } from '../../../../shared/study-log.js'
import { logStudySession } from '../../../lib/api.js'
import { useAuth } from '../../../lib/auth/auth-provider.jsx'
import { formatDuration } from '../../../lib/day.js'
import { useFormat } from '../../../lib/i18n/format.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../ui/pixel-card/pixel-card.jsx'
import LinkPicker from '../link-picker/link-picker.jsx'

const QUICK_MINUTES = [15, 30, 60, 90]
const FIELD = 'block min-h-10 w-full border-2 border-ink bg-white px-3 text-sm text-ink outline-none focus-visible:shadow-pixel-secondary'
const LABEL = 'block font-label text-[10px] text-secondary'

// "Registrar estudo": a past session added by hand. It shows in the log with a Manual tag and
// never counts for XP, streaks, badges or the activity graph (the server keeps it out of them too).
export default function ManualEntryForm({ today, options, onLogged, onCancel, onError }) {
  const t = useT()
  const { day: dayLabel } = useFormat()
  const { getToken } = useAuth()
  const id = useId()
  const [day, setDay] = useState(today)
  const [time, setTime] = useState('')
  const [minutes, setMinutes] = useState('30')
  const [topic, setTopic] = useState('')
  const [link, setLink] = useState({ caseId: null, noteId: null })
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)

  const days = Array.from({ length: STUDY_LOG.manualDays }, (_, index) => addDays(today, -index))
  const nameOf = (value, index) => (index === 0 ? t('study.today') : index === 1 ? t('study.yesterday') : dayLabel(value, { weekday: 'long', day: 'numeric', month: 'short' }))

  // Checked here first so most mistakes never reach the server; the server checks it all again.
  function check() {
    const clean = cleanTopic(topic)
    const count = Number(minutes)
    if (!clean) return { error: t('server.studyTopicMissing') }
    if (!Number.isInteger(count) || count < STUDY_LOG.manualMinMinutes || count > STUDY_LOG.manualMaxMinutes) {
      return { error: t('server.studyManualLength', { min: STUDY_LOG.manualMinMinutes, max: STUDY_LOG.manualMaxMinutes / 60 }) }
    }
    let startedAt
    if (time) {
      // Read as the reader's own clock on that day.
      const start = new Date(`${day}T${time}:00`)
      if (Number.isNaN(start.getTime()) || start.getTime() + count * 60_000 > Date.now()) return { error: t('server.studyManualStart') }
      startedAt = start.toISOString()
    }
    return { value: { day, minutes: count, topic: clean, ...(startedAt ? { startedAt } : {}), ...link } }
  }

  async function submit(event) {
    event.preventDefault()
    const { value, error } = check()
    if (error) {
      setProblem(error)
      return
    }
    setBusy(true)
    setProblem('')
    try {
      onLogged(await logStudySession(value, await getToken()))
    } catch (err) {
      setBusy(false)
      if (err?.status) setProblem(err.message)
      else onError(err)
    }
  }

  return (
    <PixelCard as="form" tone="secondary" onSubmit={submit} aria-labelledby={`${id}-title`} className="p-4 sm:p-6">
      <h2 id={`${id}-title`} className="font-pixel text-xl font-bold text-ink">
        {t('study.manual.title')}
      </h2>
      <p className="mt-1 text-sm text-muted">{t('study.manual.note')}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-day`} className={LABEL}>
            {t('study.manual.day')}
          </label>
          <select id={`${id}-day`} value={day} onChange={(event) => setDay(event.target.value)} className={`mt-1.5 ${FIELD}`}>
            {days.map((value, index) => (
              <option key={value} value={value}>
                {nameOf(value, index)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-time`} className={LABEL}>
            {t('study.manual.start')} <span className="text-muted">· {t('study.topic.optional')}</span>
          </label>
          <input id={`${id}-time`} type="time" value={time} onChange={(event) => setTime(event.target.value)} className={`mt-1.5 ${FIELD}`} />
        </div>
        <div>
          <label htmlFor={`${id}-minutes`} className={LABEL}>
            {t('study.manual.minutes')}
          </label>
          <input
            id={`${id}-minutes`}
            type="number"
            inputMode="numeric"
            min={STUDY_LOG.manualMinMinutes}
            max={STUDY_LOG.manualMaxMinutes}
            step={5}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            className={`mt-1.5 ${FIELD}`}
          />
        </div>
      </div>
      <fieldset className="mt-2 flex flex-wrap gap-2">
        <legend className="sr-only">{t('study.manual.quick')}</legend>
        {QUICK_MINUTES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={Number(minutes) === value}
            onClick={() => setMinutes(String(value))}
            className={`min-h-10 border-2 border-ink px-3 font-label text-xs ${Number(minutes) === value ? 'bg-secondary text-white' : 'bg-white text-ink hover:bg-secondary-soft'}`}
          >
            {formatDuration(value * 60)}
          </button>
        ))}
      </fieldset>

      <div className="mt-4">
        <label htmlFor={`${id}-topic`} className={LABEL}>
          {t('study.manual.topic')}
        </label>
        <input
          id={`${id}-topic`}
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          maxLength={STUDY_LOG.topic}
          aria-required="true"
          placeholder={t('study.topic.placeholder')}
          className={`mt-1.5 ${FIELD} placeholder:text-muted`}
        />
      </div>
      <div className="mt-2">
        <LinkPicker value={link} onChange={setLink} options={options} />
      </div>

      {problem && (
        <p role="alert" className="mt-3 text-sm text-primary">
          {problem}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <PixelButton type="submit" disabled={busy} className="px-4 py-3">
          {t('study.manual.submit')}
        </PixelButton>
        <PixelButton variant="ghost" onClick={onCancel} className="px-4 py-3">
          {t('study.cancel')}
        </PixelButton>
      </div>
    </PixelCard>
  )
}
