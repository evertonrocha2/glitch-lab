import { useState } from 'react'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../ui/pixel-card/pixel-card.jsx'
import QuestionText from '../question-text/question-text.jsx'

// How an alternative looks: picked before answering, then the answer key and the student's pick.
function optionTone({ letter, picked, attempt }) {
  if (!attempt) return picked === letter ? 'border-primary bg-primary-soft' : 'border-ink bg-white hover:bg-mist'
  if (letter === attempt.answer) return 'border-primary bg-primary-soft'
  if (letter === attempt.choice) return 'border-secondary bg-secondary-soft'
  return 'border-line bg-white text-muted'
}

function Alternative({ item, picked, attempt, onPick }) {
  const t = useT()
  const mark = attempt && (item.letter === attempt.answer ? t('exams.mark.answer') : item.letter === attempt.choice ? t('exams.mark.yours') : null)
  return (
    <button
      type="button"
      disabled={Boolean(attempt)}
      aria-pressed={attempt ? undefined : picked === item.letter}
      onClick={() => onPick(item.letter)}
      className={`flex w-full items-start gap-3 border-2 p-3 text-left transition-colors disabled:cursor-default ${optionTone({ letter: item.letter, picked, attempt })}`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center border-2 border-ink bg-white font-label text-xs text-ink">{item.letter}</span>{' '}
      <span className="min-w-0 flex-1 break-words pt-1">
        {item.image && !item.text.trim() ? (
          <img src={item.image} alt={t('exams.imageAlt', { letter: item.letter })} loading="lazy" className="h-auto max-w-full" />
        ) : (
          item.text
        )}
        {mark && <span className="mt-1 block font-label text-[10px] text-primary">{mark}</span>}
      </span>
    </button>
  )
}

// One real exam question: where it comes from, its text, five alternatives, and once answered,
// whether the student got it and which one is right.
export default function QuestionCard({ question, onAnswer, examName = 'ENEM' }) {
  const t = useT()
  const [picked, setPicked] = useState(null)
  const [sending, setSending] = useState(false)
  const { attempt } = question

  async function submit() {
    if (!picked || sending) return
    setSending(true)
    try {
      await onAnswer(picked)
    } finally {
      setSending(false)
    }
  }

  return (
    <PixelCard className="p-4 sm:p-6">
      <p className="font-label text-[10px] text-secondary">{t('exams.badge.official', { exam: examName, year: question.year, number: question.number })}</p>
      <QuestionText text={question.context} className="mt-4" />
      {/* Regular weight: the source sometimes puts a whole poem or text here, not only the command. */}
      <QuestionText text={question.statement} className="mt-4" />
      <div className="mt-5 space-y-2">
        {question.alternatives.map((item) => (
          <Alternative key={item.letter} item={item} picked={picked} attempt={attempt} onPick={setPicked} />
        ))}
      </div>
      {attempt ? (
        <p role="status" className={`mt-5 font-pixel text-lg font-bold ${attempt.correct ? 'text-primary' : 'text-secondary'}`}>
          {attempt.correct ? t('exams.result.right') : t('exams.result.wrong', { answer: attempt.answer })}
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <PixelButton onClick={submit} disabled={!picked || sending} className="px-5 py-3">
            {t('exams.answer')}
          </PixelButton>
          {!picked && <span className="text-sm text-muted">{t('exams.pick')}</span>}
        </div>
      )}
    </PixelCard>
  )
}
