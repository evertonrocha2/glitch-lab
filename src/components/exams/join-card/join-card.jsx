import { useId, useState } from 'react'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../ui/pixel-card/pixel-card.jsx'

// Joining an exam's track, with an optional exam date. onJoin({ examDate }) does the saving.
export default function JoinCard({ examName, today, onJoin }) {
  const t = useT()
  const dateId = useId()
  const [examDate, setExamDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await onJoin({ examDate: examDate || null })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PixelCard as="form" tone="secondary" onSubmit={submit} className="p-5 sm:p-6">
      <h2 className="font-pixel text-2xl font-bold text-ink">{t('exams.join.title', { exam: examName })}</h2>
      <p className="mt-2 text-muted">{t('exams.join.lead')}</p>
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
        <label htmlFor={dateId} className="flex flex-col gap-1 text-sm text-ink">
          {t('exams.join.date')}
          <input
            id={dateId}
            type="date"
            min={today}
            value={examDate}
            onChange={(event) => setExamDate(event.target.value)}
            className="min-h-10 border-2 border-ink bg-white px-3 py-2 text-ink"
          />
        </label>
        <PixelButton type="submit" disabled={saving} className="px-5 py-3">
          {saving ? t('exams.join.saving') : t('exams.join.cta')}
        </PixelButton>
      </div>
    </PixelCard>
  )
}
