import { useCallback, useEffect, useRef, useState } from 'react'
import { REVIEW_XP } from '../../../../shared/review.js'
import { AuthError, getReview, startReview } from '../../../lib/api.js'
import { useAuth } from '../../../lib/auth/AuthProvider.jsx'
import { localDay } from '../../../lib/day.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../../../lib/i18n/format.js'
import { useLabels } from '../../../lib/i18n/labels.js'
import { useProgress } from '../../../lib/progress/ProgressProvider.jsx'
import ErrorNotice from '../../ui/error-notice/error-notice.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import ReviewSession from '../review-session/review-session.jsx'

const SHOWN_CONCEPTS = 5

// "Today's review" on the daily page: what's due, and the session itself once opened.
export default function ReviewToday({ className = '' }) {
  const { getToken, signOut } = useAuth()
  const { refresh: refreshProgress } = useProgress()
  const t = useT()
  const labels = useLabels()
  const format = useFormat()
  const [review, setReview] = useState(null)
  const [session, setSession] = useState(null)
  const [message, setMessage] = useState('')
  const [opening, setOpening] = useState(false)
  const busy = useRef(false)
  // The day the session was opened on, so an answer after midnight still finds it.
  const [today, setToday] = useState(localDay)

  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
    },
    [signOut],
  )

  const load = useCallback(async () => {
    try {
      const day = localDay()
      setToday(day)
      setReview(await getReview(day, await getToken()))
    } catch (err) {
      await handleError(err)
    }
  }, [getToken, handleError])

  useEffect(() => {
    load()
  }, [load])

  async function open() {
    if (busy.current) return
    busy.current = true
    setOpening(true)
    setMessage('')
    try {
      setSession(await startReview(today, await getToken()))
    } catch (err) {
      await handleError(err)
    } finally {
      busy.current = false
      setOpening(false)
    }
  }

  function close() {
    setSession(null)
    load()
    refreshProgress()
  }

  const due = review?.due ?? []
  const hasOpen = Boolean(review?.session)

  return (
    <section aria-labelledby="review-title" className={className}>
      <h2 id="review-title" className="font-pixel text-2xl font-bold text-ink sm:text-3xl">
        {t('review.title')}
      </h2>
      <p className="mt-2 max-w-2xl text-muted">{t('review.lead')}</p>

      <div className="relative mt-5 overflow-hidden border-2 border-ink bg-white shadow-pixel">
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-primary px-5 py-2 font-label text-xs text-white">
          <span>{t('review.tag')}</span>
          <span>{t('review.xpEach', { xp: REVIEW_XP.card })}</span>
        </div>

        {session ? (
          <ReviewSession session={session} today={today} getToken={getToken} onError={handleError} onClose={close} xpCap={review?.xpCap ?? 0} />
        ) : (
          <div className="p-5 sm:p-6">
            {message && (
              <div className="mb-4">
                <ErrorNotice message={message} />
              </div>
            )}
            {!review && !message && (
              <p role="status" className="font-label text-xs text-muted">
                {t('review.loading')}
              </p>
            )}
            {review && review.met === 0 && <p className="text-ink">{t('review.none')}</p>}
            {review && review.met > 0 && (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  {due.length > 0 ? (
                    <>
                      <p className="font-pixel text-2xl font-bold text-primary">{t('review.due', { count: due.length })}</p>
                      <ul aria-label={t('review.dueList')} className="mt-3 flex flex-wrap gap-2">
                        {due.slice(0, SHOWN_CONCEPTS).map((item) => (
                          <li key={item.concept} className="border-2 border-ink bg-primary-soft px-2 py-0.5 text-sm text-ink">
                            {labels.concept(item.concept)}
                          </li>
                        ))}
                        {due.length > SHOWN_CONCEPTS && (
                          <li className="border-2 border-dashed border-muted/60 px-2 py-0.5 text-sm text-muted">{t('review.more', { count: due.length - SHOWN_CONCEPTS })}</li>
                        )}
                      </ul>
                    </>
                  ) : (
                    <>
                      <p className="font-pixel text-2xl font-bold text-ink">{t('review.caughtUp')}</p>
                      {review.nextDueDay && <p className="mt-2 text-sm text-muted">{t('review.next', { day: format.day(review.nextDueDay, { weekday: 'long', month: 'short', day: 'numeric' }) })}</p>}
                    </>
                  )}
                  {review.day.cards > 0 && <p className="mt-3 text-sm text-muted">{t('review.tally', { right: review.day.right, cards: review.day.cards, xp: review.day.xp })}</p>}
                </div>
                {(due.length > 0 || hasOpen) && (
                  <PixelButton onClick={open} disabled={opening} className="shrink-0 px-6 py-3">
                    {opening ? t('review.starting') : hasOpen ? t('review.resume') : t('review.start')}
                  </PixelButton>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
