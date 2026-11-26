import { Link } from 'react-router'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// One topic of an exam: a link to study it, with how the student did and a badge when it has a
// lesson; "coming soon" while the topic has neither questions nor a lesson.
export default function TopicRow({ examId, topic, lesson = false }) {
  const t = useT()
  if (!topic.questions && !lesson) {
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
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 break-words font-semibold text-ink">{topic.name}</span>
          {lesson && <span className="shrink-0 border-2 border-primary bg-primary-soft px-1.5 py-0.5 font-label text-[10px] text-primary">{t('exams.lesson.badge')}</span>}
        </span>
        <span className="mt-1 block text-sm text-muted">{topic.questions ? t('exams.topic.stats', topic) : t('exams.lesson.soonQuestions')}</span>
      </Link>
    </li>
  )
}
