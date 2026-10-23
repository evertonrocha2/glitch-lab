import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { currentStep, INTERROGATION_LIMITS, INTERROGATION_STEPS } from '../../shared/interrogation.js'
import AppShell from '../components/AppShell.jsx'
import ErrorNotice from '../components/ErrorNotice.jsx'
import InterrogationStepper from '../components/interrogation/InterrogationStepper.jsx'
import InterrogationTimeline from '../components/interrogation/InterrogationTimeline.jsx'
import PageHeader from '../components/PageHeader.jsx'
import PixelButton from '../components/pixel/PixelButton.jsx'
import Working from '../components/pixel/Working.jsx'
import { AuthError, answerInterrogation, getInterrogation } from '../lib/api.js'
import { useAuth } from '../lib/auth/AuthProvider.jsx'
import { splitError } from '../lib/caseInfo.js'
import { useT } from '../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../lib/i18n/labels.js'
import { useExportInterrogation } from '../lib/interrogation/useExportInterrogation.js'
import { useProgress } from '../lib/progress/ProgressProvider.jsx'

// What the coach said about the last answer. Lives in a polite live region, so a screen reader
// hears it without losing its place.
function CoachReply({ turn }) {
  const t = useT()
  if (!turn) return null
  const passed = turn.passed
  const next = INTERROGATION_STEPS[INTERROGATION_STEPS.indexOf(turn.step) + 1]
  return (
    <div className={`border-2 border-ink p-5 ${passed ? 'bg-secondary-soft shadow-pixel-secondary' : 'bg-primary-soft shadow-pixel'}`}>
      <p className={`font-label text-sm ${passed ? 'text-secondary' : 'text-primary'}`}>
        {passed ? t('interrogation.feedback.passed') : t('interrogation.feedback.notYet')}
      </p>
      <p className="mt-2 text-ink">{turn.feedback}</p>
      {!passed && turn.question && (
        <p className="mt-3 text-ink">
          <span className="font-semibold">{t('interrogation.feedback.question')}</span> {turn.question}
        </p>
      )}
      {passed && next && <p className="mt-3 text-sm text-muted">{t('interrogation.feedback.next', { title: t(`interrogation.step.${next}.title`) })}</p>}
    </div>
  )
}

export default function InterrogationPage() {
  const { caseId } = useParams()
  const t = useT()
  const labels = useLabels()
  const { getToken, signOut } = useAuth()
  const { refresh: refreshProgress } = useProgress()
  const [data, setData] = useState(null)
  const [answer, setAnswer] = useState('')
  const [sending, setSending] = useState(false)
  const [lastTurn, setLastTurn] = useState(null)
  const [justFinished, setJustFinished] = useState(false)
  const [message, setMessage] = useState('')
  const busy = useRef(false)
  const field = useRef(null)

  // An expired session signs out; the route guard brings the person back here after login.
  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
    },
    [signOut],
  )
  const { exportNote, exporting } = useExportInterrogation({ onError: handleError })

  useEffect(() => {
    let alive = true
    getToken()
      .then((token) => getInterrogation(caseId, token))
      .then((loaded) => alive && setData(loaded))
      .catch((err) => alive && handleError(err))
    return () => {
      alive = false
    }
  }, [caseId, getToken, handleError])

  async function submit(event) {
    event.preventDefault()
    if (busy.current || answer.trim() === '') return
    busy.current = true
    setSending(true)
    setMessage('')
    try {
      const result = await answerInterrogation({ caseId, answer }, await getToken())
      setData((current) => ({ ...current, interrogation: result.interrogation }))
      setLastTurn(result.turn)
      if (result.turn.passed) setAnswer('')
      if (result.finished) {
        setJustFinished(true)
        refreshProgress()
      } else {
        field.current?.focus()
      }
    } catch (err) {
      await handleError(err)
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  const kase = data?.case
  const interrogation = data?.interrogation
  const step = currentStep(interrogation)
  const index = interrogation?.step ?? 0
  const total = INTERROGATION_STEPS.length
  const triesHere = interrogation?.turns.filter((turn) => turn.step === step) ?? []
  const error = kase ? splitError(kase.error) : null

  return (
    <AppShell>
      <Link to="/board" className="-my-3 inline-flex min-h-10 items-center font-label text-xs text-ink hover:text-primary">
        &lt; {t('interrogation.page.back')}
      </Link>
      <PageHeader className="mt-6" kicker={t('interrogation.page.kicker')} title={t('interrogation.page.title')} lead={t('interrogation.page.lead')} />

      {message && (
        <div className="mt-6">
          <ErrorNotice message={message} />
        </div>
      )}

      {!data && !message && (
        <p role="status" className="mt-8 font-label text-xs text-muted">
          {t('interrogation.page.loading')}
        </p>
      )}

      {kase && interrogation && (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* First in reading order (the questions are about this error); the right column on desktop. */}
          <aside aria-labelledby="interrogation-case" className="min-w-0 border-2 border-ink bg-mist p-5 lg:sticky lg:top-6 lg:order-last">
            <h2 id="interrogation-case" className="font-label text-xs text-primary">
              {t('interrogation.page.case')}
            </h2>
            <p className="mt-3 wrap-break-word font-pixel text-xl font-bold text-ink">{error.type}</p>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap wrap-break-word border-2 border-ink bg-white p-3 font-mono text-xs leading-relaxed text-ink">{kase.error}</pre>
            <p className="mt-3 flex flex-wrap gap-1.5">
              <span className="bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary">{labels.concept(kase.concept)}</span>
              <span className="border border-line bg-white px-1.5 py-0.5 font-mono text-xs text-muted">{kase.language}</span>
            </p>
            {kase.code && (
              <details className="mt-4 border-2 border-ink bg-white">
                <summary className="cursor-pointer px-4 py-3 font-label text-xs leading-4 text-ink">{t('interrogation.page.code')}</summary>
                <pre className="overflow-x-auto border-t-2 border-ink bg-mist p-4 font-mono text-sm leading-relaxed text-ink">{kase.code}</pre>
              </details>
            )}
          </aside>

          <div className="min-w-0 space-y-6">
            <InterrogationStepper interrogation={interrogation} />

            {step ? (
              <form onSubmit={submit} className="border-2 border-ink bg-white p-5 shadow-pixel sm:p-6">
                <p className="font-label text-xs text-secondary">{t('interrogation.step.number', { number: index + 1, total })}</p>
                <h2 className="mt-2 font-pixel text-2xl font-bold text-ink">{t(`interrogation.step.${step}.title`)}</h2>
                <p className="mt-2 text-ink">{t(`interrogation.step.${step}.ask`)}</p>

                <label htmlFor="interrogation-answer" className="mt-5 block font-label text-xs text-ink">
                  {t('interrogation.answer.label')}
                </label>
                <textarea
                  id="interrogation-answer"
                  ref={field}
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    // Ctrl/Cmd + Enter sends, Enter alone makes a new line.
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit(event)
                  }}
                  placeholder={t(`interrogation.step.${step}.example`)}
                  maxLength={INTERROGATION_LIMITS.answer}
                  rows={4}
                  aria-describedby="interrogation-answer-hint"
                  className="mt-2 block w-full resize-y border-2 border-ink bg-white px-3 py-2.5 text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                />
                <p id="interrogation-answer-hint" className="mt-2 text-sm text-muted">
                  {t('interrogation.answer.hint', { max: INTERROGATION_LIMITS.answer })}
                </p>
                <PixelButton type="submit" disabled={sending || answer.trim() === ''} className="mt-4 px-5 py-3">
                  {t('interrogation.answer.send')}
                </PixelButton>
              </form>
            ) : (
              <div className="border-2 border-ink bg-secondary-soft p-5 shadow-pixel-secondary">
                <p className="font-label text-sm text-secondary">{t('interrogation.done.title')}</p>
                <p className="mt-2 text-ink">
                  {justFinished
                    ? t('interrogation.done.text', { xp: interrogation.xp, badge: labels.badgeName('scientific-method') })
                    : t('interrogation.done.again')}
                </p>
                <PixelButton variant="secondary" onClick={() => exportNote(kase, interrogation)} disabled={exporting} className="mt-4">
                  {exporting ? t('interrogation.exporting') : t('interrogation.export')}
                </PixelButton>
              </div>
            )}

            {sending && <Working label={t('interrogation.answer.checking')} />}
            <div aria-live="polite">
              <CoachReply turn={lastTurn} />
            </div>

            {step && triesHere.length > 0 && (
              <details className="border-2 border-ink bg-white">
                <summary className="cursor-pointer px-4 py-3 font-label text-xs leading-4 text-ink">
                  {t('interrogation.history')} ({triesHere.length})
                </summary>
                <ol className="space-y-3 border-t-2 border-ink p-4 text-sm">
                  {triesHere.map((turn, number) => (
                    <li key={`${turn.at}-${number}`} className="border-l-2 border-primary pl-3">
                      <p className="whitespace-pre-wrap wrap-break-word text-ink">{turn.answer}</p>
                      <p className="mt-1 text-muted">
                        {turn.feedback} {turn.question}
                      </p>
                    </li>
                  ))}
                </ol>
              </details>
            )}

            {interrogation.turns.some((turn) => turn.passed) && <InterrogationTimeline interrogation={interrogation} />}
          </div>
        </div>
      )}
    </AppShell>
  )
}
