import { useEffect, useRef } from 'react'
import { languageById } from '../../../shared/riddle/languages.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../lib/i18n/labels.js'
import PixelButton from '../pixel/PixelButton.jsx'
import CodeLines from './CodeLines.jsx'
import Countdown from './Countdown.jsx'

// What came back for an answer: right or not, the bug line, one sentence on why and the bug type.
// Read out by screen readers; its button takes the focus so Enter goes on to the next snippet.
function RoundResult({ result, actionLabel, onAction, busy }) {
  const t = useT()
  const labels = useLabels()
  const button = useRef(null)
  useEffect(() => {
    button.current?.focus()
  }, [])
  const title = result.correct ? t('hunt.result.right') : result.timedOut ? t('hunt.result.timeout') : t('hunt.result.wrong')
  return (
    <div className={`border-2 border-ink p-4 ${result.correct ? 'bg-secondary-soft' : 'bg-primary-soft'}`}>
      <div role="status" aria-live="polite">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <strong className="font-pixel text-xl font-bold text-ink">{title}</strong>
          {result.points > 0 && <span className="bg-secondary px-1.5 py-0.5 font-label text-xs text-white">{t('hunt.result.points', { count: result.points })}</span>}
        </p>
        <p className="mt-2 text-sm font-semibold text-ink">{t('hunt.result.line', { line: result.answer })}</p>
        <p className="mt-1 text-sm text-ink">{result.explanation}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="border-2 border-ink bg-white px-2 py-1 font-label text-[10px] text-primary">{labels.concept(result.concept)}</span>
        {onAction && (
          <PixelButton ref={button} onClick={onAction} disabled={busy}>
            {actionLabel}
          </PixelButton>
        )}
      </div>
    </div>
  )
}

// One round of the hunt: the symptom, the clock, the snippet's lines and, once answered, the result.
// phase: 'playing' (the clock runs), 'sending' (a line was picked) or 'revealed'.
export default function HuntRound({ kicker, score, snippet, deadline, totalMs, phase, picked, result, onPick, onExpire, actionLabel, onAction, busy }) {
  const t = useT()
  return (
    <section aria-label={kicker} className="border-2 border-ink bg-white shadow-pixel">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b-2 border-ink bg-primary px-4 py-2 font-label text-xs text-white">
        <span>{kicker}</span>
        <span className="flex items-center gap-4">
          <span>{languageById(snippet.language)?.name ?? snippet.language}</span>
          {score !== undefined && (
            <span>
              {t('hunt.score')} <strong className="tabular-nums">{score}</strong>
            </span>
          )}
        </span>
      </header>
      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <p className="font-label text-[10px] text-secondary">{t('hunt.symptom')}</p>
          <p className="mt-1 border-2 border-ink bg-mist px-3 py-2 font-mono text-xs leading-relaxed text-ink wrap-break-word">
            <span aria-hidden="true" className="font-bold text-secondary">
              &gt;{' '}
            </span>
            {snippet.symptom}
          </p>
        </div>
        {phase !== 'revealed' && <Countdown deadline={deadline} totalMs={totalMs} running={phase === 'playing'} onExpire={onExpire} />}
        <CodeLines
          code={snippet.code}
          onPick={onPick}
          disabled={phase !== 'playing'}
          picked={picked}
          answer={phase === 'revealed' ? (result?.answer ?? null) : null}
          autoFocus={phase === 'playing'}
        />
        {phase === 'sending' && (
          <p role="status" className="font-label text-xs text-muted">
            {t('hunt.sending')}
          </p>
        )}
        {phase === 'revealed' && result && <RoundResult result={result} actionLabel={actionLabel} onAction={onAction} busy={busy} />}
      </div>
    </section>
  )
}
