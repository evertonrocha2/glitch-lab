import { useEffect, useRef, useState } from 'react'
import { daysBetween } from '../../../shared/review.js'
import { answerReview } from '../../lib/api.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../lib/i18n/labels.js'
import PixelButton from '../pixel/PixelButton.jsx'

const firstOpen = (session) => {
  const index = session.cards.findIndex((card) => !session.answers.some((answer) => answer.index === card.index))
  return index === -1 ? session.cards.length : index
}

// The broken code, one line per row with its number. `bugLine` marks a line (a fix card);
// `onPick` turns every non-blank line into a button (a "which line?" card). Long lines scroll
// sideways inside the block, and the answer tags stick to its right edge so they stay readable.
function CodeLines({ lines, bugLine = null, onPick, picked, answer, disabled }) {
  const t = useT()
  return (
    <div className="overflow-x-auto border-2 border-ink bg-white">
      <ol aria-label={t('review.code')} className="min-w-max py-1 font-mono text-xs leading-relaxed text-ink">
        {lines.map((line, index) => {
          const number = index + 1
          const id = `l${number}`
          const marked = bugLine === index
          const blank = !line.trim()
          const isAnswer = answer === id
          const isPicked = picked === id
          const tone = isAnswer ? 'bg-secondary-soft' : isPicked ? 'bg-primary-soft' : marked ? 'bg-primary-soft' : ''
          const body = (
            <>
              <span aria-hidden="true" className="w-7 shrink-0 select-none pr-2 text-right text-muted">
                {number}
              </span>
              <span className="whitespace-pre">{line || ' '}</span>
            </>
          )
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: lines are fixed for a card
            <li key={index} className={tone}>
              {onPick && !blank ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(id)}
                  aria-label={`${t('review.lineNumber', { line: number })}: ${line.trim()}`}
                  className="flex w-full min-h-10 items-center px-2 lg:min-h-8 text-left hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:hover:bg-transparent"
                >
                  {body}
                  {(isAnswer || isPicked) && (
                    <span className={`sticky right-2 ml-auto shrink-0 px-1.5 py-0.5 font-label text-[10px] leading-none text-white ${isAnswer ? 'bg-secondary' : 'bg-ink'}`}>{isAnswer ? t('review.rightAnswer') : t('review.yourAnswer')}</span>
                  )}
                </button>
              ) : (
                <span className={`flex px-2 ${marked ? 'border-l-4 border-primary' : ''}`}>{body}</span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// A button per option: a bug type (cause cards) or a line of code (fix cards).
function Options({ card, onPick, picked, answer, disabled }) {
  const t = useT()
  const labels = useLabels()
  return (
    <div role="group" aria-label={t('review.options')} className="grid gap-2 sm:grid-cols-2">
      {card.options.map((option) => {
        const isAnswer = answer === option.id
        const isPicked = picked === option.id
        const border = isAnswer ? 'border-secondary bg-secondary-soft' : isPicked ? 'border-primary bg-primary-soft' : 'border-ink bg-white hover:bg-mist'
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(option.id)}
            className={`flex min-h-11 items-center justify-between gap-3 border-2 px-3 py-2 text-left text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default ${border}`}
          >
            {card.type === 'cause' ? (
              <span>{labels.concept(option.value)}</span>
            ) : (
              <code className="min-w-0 break-all font-mono text-xs">{option.value}</code>
            )}
            {(isAnswer || isPicked) && <span className="shrink-0 text-[11px] text-muted">{isAnswer ? t('review.rightAnswer') : t('review.yourAnswer')}</span>}
          </button>
        )
      })}
    </div>
  )
}

function Feedback({ card, result, item, xp, today, onNext, last }) {
  const t = useT()
  const labels = useLabels()
  const heading = useRef(null)
  useEffect(() => heading.current?.focus(), [])
  const days = item ? daysBetween(today, item.dueDay) : null
  return (
    <div className={`mt-5 border-2 p-4 ${result.correct ? 'border-secondary bg-secondary-soft' : 'border-primary bg-primary-soft'}`}>
      <h4 ref={heading} tabIndex={-1} className="font-pixel text-xl font-bold text-ink outline-none">
        {result.correct ? t('review.right') : t('review.wrong')}
        {xp > 0 && <span className="ml-2 font-label text-xs text-secondary">{t('review.xpGained', { xp })}</span>}
      </h4>
      {!result.correct && card.type === 'cause' && <p className="mt-1 text-sm text-ink">{t('review.answerConcept', { name: labels.concept(result.concept) })}</p>}
      {!result.correct && card.type === 'line' && <p className="mt-1 text-sm text-ink">{t('review.answerLine', { line: result.answer.slice(1) })}</p>}
      {card.type === 'cause' && result.correct && <p className="mt-1 text-sm text-ink">{t('review.bugType', { name: labels.concept(result.concept) })}</p>}
      {card.type === 'line' && result.fixed && (
        <div className="mt-3">
          <p className="font-label text-[10px] text-muted">{t('review.theFix')}</p>
          <pre className="mt-1 overflow-x-auto border-2 border-ink bg-white px-3 py-2 font-mono text-xs text-ink">{result.fixed}</pre>
        </div>
      )}
      {result.explanation && (
        <div className="mt-3">
          <p className="font-label text-[10px] text-muted">{t('review.why')}</p>
          <p className="mt-1 text-sm text-ink">{result.explanation}</p>
        </div>
      )}
      {item && (
        <p className="mt-3 text-xs text-muted">
          {t('review.box', { box: item.box })} {t('review.backIn', { count: days })}
        </p>
      )}
      <PixelButton onClick={onNext} className="mt-4 px-5 py-3">
        {last ? t('review.finish') : t('review.nextCard')}
      </PixelButton>
    </div>
  )
}

// One review session: a card at a time, graded on the server, with feedback before the next.
export default function ReviewSession({ session: initial, today, getToken, onError, onClose, xpCap }) {
  const t = useT()
  const labels = useLabels()
  const [session, setSession] = useState(initial)
  const [position, setPosition] = useState(() => firstOpen(initial))
  // What the last answers returned, by card index: { item, xp }.
  const [graded, setGraded] = useState({})
  const [day, setDay] = useState(null)
  const [sending, setSending] = useState(false)
  const busy = useRef(false)
  const doneHeading = useRef(null)
  const total = session.cards.length
  const done = position >= total

  useEffect(() => {
    if (done) doneHeading.current?.focus()
  }, [done])

  async function pick(choice) {
    const card = session.cards[position]
    if (busy.current || session.answers.some((answer) => answer.index === card.index)) return
    busy.current = true
    setSending(true)
    try {
      const response = await answerReview({ sessionId: session.id, index: card.index, choice, today }, await getToken())
      setSession(response.session)
      setGraded((current) => ({ ...current, [card.index]: { item: response.item, xp: response.xp } }))
      setDay(response.day)
    } catch (err) {
      await onError(err)
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="p-5 sm:p-6">
        <h3 ref={doneHeading} tabIndex={-1} className="font-pixel text-2xl font-bold text-ink outline-none">
          {t('review.doneTitle')}
        </h3>
        <p className="mt-2 text-ink">{t('review.doneScore', { right: session.right, total })}</p>
        {day && <p className="mt-1 text-sm text-muted">{t('review.doneXp', { xp: day.xp, cap: xpCap })}</p>}
        <PixelButton onClick={onClose} className="mt-5 px-5 py-3">
          {t('review.close')}
        </PixelButton>
      </div>
    )
  }

  const card = session.cards[position]
  const result = session.answers.find((answer) => answer.index === card.index) ?? null
  const answered = result !== null
  const pickedProps = { onPick: pick, picked: result?.choice, answer: result?.answer, disabled: answered || sending }

  return (
    <div className="p-5 sm:p-6" aria-busy={sending}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-label text-xs text-primary">{t('review.cardOf', { index: position + 1, total })}</p>
        <div aria-hidden="true" className="flex gap-[3px]">
          {session.cards.map((item, index) => (
            <span key={item.index} className={`h-2.5 w-5 border border-ink ${index < position ? 'bg-primary' : index === position ? 'bg-secondary' : 'bg-white'}`} />
          ))}
        </div>
      </div>

      <h3 className="mt-3 font-pixel text-xl font-bold leading-tight text-ink sm:text-2xl">
        {card.type === 'fix' ? t('review.question.fix', { line: card.prompt.bugLine + 1 }) : t(`review.question.${card.type}`)}
      </h3>
      {card.concept && <p className="mt-1 text-sm text-muted">{t('review.bugType', { name: labels.concept(card.concept) })}</p>}

      <div className="mt-4 space-y-3">
        {card.type === 'cause' && (
          <div>
            <p className="font-label text-[10px] text-muted">{t('review.error')}</p>
            <p className="mt-1 border-2 border-ink bg-mist px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink wrap-break-word">{card.prompt.error}</p>
          </div>
        )}
        {card.type !== 'cause' && card.prompt.symptom && (
          <div>
            <p className="font-label text-[10px] text-muted">{t('review.symptom')}</p>
            <p className="mt-1 border-2 border-ink bg-mist px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink wrap-break-word">{card.prompt.symptom}</p>
          </div>
        )}
        {card.type === 'line' ? (
          <CodeLines lines={card.prompt.lines} {...pickedProps} />
        ) : (
          card.prompt.lines && <CodeLines lines={card.prompt.lines} bugLine={card.type === 'fix' ? card.prompt.bugLine : null} />
        )}
        {card.type !== 'line' && <Options card={card} {...pickedProps} />}
      </div>

      <div aria-live="polite">
        {answered && (
          <Feedback
            key={card.index}
            card={card}
            result={result}
            item={graded[card.index]?.item}
            xp={graded[card.index]?.xp ?? 0}
            today={today}
            last={position === total - 1}
            onNext={() => setPosition((current) => current + 1)}
          />
        )}
      </div>
    </div>
  )
}

