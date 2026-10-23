import { useEffect, useRef } from 'react'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../../lib/i18n/labels.js'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import QuestionBadge from '../question-badge/question-badge.jsx'

const textClass = 'whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-ink'

// The card the tutor proposes once it knows the topic: a preview, then Create or Not now.
// message: the tutor answer that carries it ({ card, cardState, caseId, cardError }).
export default function CardProposal({ message, creating, onAccept, onDismiss, onReopen, onOpenCase }) {
  const t = useT()
  const labels = useLabels()
  const { card, cardState } = message
  const openButton = useRef(null)
  const wasCreated = useRef(cardState === 'created')

  // Once the card is made, focus goes to the way to open it (the Create button is gone).
  useEffect(() => {
    if (cardState === 'created' && !wasCreated.current) openButton.current?.focus()
    wasCreated.current = cardState === 'created'
  }, [cardState])

  if (cardState === 'dismissed') {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>{t('question.card.dismissed')}</span>
        <PixelButton variant="ghost" onClick={() => onReopen(message.id)} className="px-2.5 py-1.5 text-[10px]">
          {t('question.card.undo')}
        </PixelButton>
      </div>
    )
  }

  const created = cardState === 'created'
  const busy = creating === message.id
  return (
    <section aria-label={t('question.card.kicker')} className="mt-3 border-2 border-ink bg-secondary-soft p-3 shadow-pixel-secondary">
      <p className="font-label text-[10px] text-secondary">{t('question.card.kicker')}</p>
      {!created && <p className="mt-1 text-sm text-ink">{t('question.card.lead')}</p>}

      <div className="mt-2.5 border-2 border-ink bg-white p-3">
        <p className="flex flex-wrap items-center gap-1.5">
          <QuestionBadge topic={card.topic} />
          <span className="bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary">{labels.concept(card.concept)}</span>
          {card.language && <span className="border border-line px-1.5 py-0.5 font-mono text-xs text-muted">{card.language}</span>}
        </p>
        <p className="mt-2 wrap-break-word font-pixel text-lg font-bold leading-tight text-ink">{card.title}</p>
        <p className={`mt-1 ${textClass}`}>{card.summary}</p>
        <details className="mt-2 text-sm">
          <summary className="flex min-h-10 cursor-pointer items-center font-label text-[10px] text-secondary">{t('question.card.more')}</summary>
          <p className="font-label text-[10px] text-muted">{t('question.card.explanation')}</p>
          <p className={`mt-1 ${textClass}`}>{card.explanation}</p>
          <p className="mt-2 font-label text-[10px] text-muted">{t('question.card.exercise')}</p>
          <pre className="mt-1 whitespace-pre-wrap wrap-break-word border-2 border-ink bg-mist p-2.5 font-mono text-xs leading-relaxed text-ink">{card.exercise.prompt}</pre>
        </details>
      </div>

      {created ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink">{t('question.card.created')}</p>
          <PixelButton ref={openButton} variant="secondary" onClick={() => onOpenCase(message.caseId)} className="px-3 py-2 text-[10px]">
            {t('question.card.openCard')}
          </PixelButton>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <PixelButton variant="secondary" onClick={() => onAccept(message.id)} disabled={Boolean(creating)} className="px-3 py-2 text-[10px]">
            {busy ? t('question.card.creating') : t('question.card.create')}
          </PixelButton>
          <PixelButton variant="ghost" onClick={() => onDismiss(message.id)} disabled={busy} className="px-3 py-2 text-[10px]">
            {t('question.card.dismiss')}
          </PixelButton>
        </div>
      )}
      {message.cardError && (
        <p role="alert" className="mt-2 text-sm text-ink">
          {message.cardError}
        </p>
      )}
    </section>
  )
}
