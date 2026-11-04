import { Link } from 'react-router'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// One topic of an exam: a link to practice it, with how the student did; "coming soon" while the
// topic has no questions yet.
export default function TopicRow({ examId, topic }) {
  const t = useT()
  if (!topic.questions) {
    return (
      <li className="flex items-center justify-between gap-3 border-2 border-dashed border-line px-4 py-3 text-muted">
        <span className="min-w-0 break-words">{topic.name}</span>
        <span className="shrink-0 font-label text-[10px]">{t('exams.topic.soon')}</span>
      </li>
    )
  }
  return (
    <li>
      <Link
        to={`/exams/${examId}/${topic.id}`}
        className="block border-2 border-ink bg-white px-4 py-3 transition-[translate,box-shadow] duration-100 hover:-translate-y-0.5 hover:shadow-pixel"
      >
        <span className="block break-words font-semibold text-ink">{topic.name}</span>
        <span className="mt-1 block text-sm text-muted">{t('exams.topic.stats', topic)}</span>
      </Link>
    </li>
  )
}
