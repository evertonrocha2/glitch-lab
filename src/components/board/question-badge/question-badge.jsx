import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// "Question" on a card made from a doubt chat, and the topic it is about. Blue, the tutor's color,
// next to the purple bug type.
export default function QuestionBadge({ topic }) {
  const t = useT()
  return (
    <>
      <span className="border border-ink bg-secondary px-1.5 py-0.5 font-label text-[10px] leading-4 text-white">{t('question.badge')}</span>
      {topic && <span className="bg-secondary-soft px-1.5 py-0.5 text-xs font-semibold text-secondary">{topic}</span>}
    </>
  )
}
