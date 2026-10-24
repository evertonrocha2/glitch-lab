import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { addDays, groupStudyLog, STUDY_LOG, weekSummary } from '../../../shared/study-log.js'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ManualEntryForm from '../../components/study/manual-entry-form/manual-entry-form.jsx'
import SessionRow from '../../components/study/session-row/session-row.jsx'
import WeekSummary from '../../components/study/week-summary/week-summary.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import { AuthError, listStudySessions } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { formatDuration, localDay } from '../../lib/day.js'
import { useFormat } from '../../lib/i18n/format.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useLinkOptions } from '../../lib/study/link-options.js'
import { useStudyTimer } from '../../lib/timer/study-timer-provider.jsx'
import StudyPageSkeleton from './study-page-skeleton.jsx'

// How many days the page shows at first, and adds with "Show older days".
const PAGE_DAYS = 30

function EmptyLog({ onLog }) {
  const t = useT()
  const { running, start } = useStudyTimer()
  return (
    <PixelCard tone="muted" className="mt-10 p-6 text-center sm:p-10">
      <p className="font-label text-xs text-secondary">{t('study.empty.kicker')}</p>
      <h2 className="mt-2 font-pixel text-2xl font-bold text-ink">{t('study.empty.title')}</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">{t('study.empty.lead')}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {running ? (
          <p className="font-label text-xs text-primary">{t('study.empty.running')}</p>
        ) : (
          <PixelButton onClick={() => start()} className="px-4 py-3">
            {t('study.empty.start')}
          </PixelButton>
        )}
        <PixelButton variant="ghost" onClick={onLog} className="px-4 py-3">
          {t('study.log')}
        </PixelButton>
      </div>
    </PixelCard>
  )
}

// /study: every run of the timer (and every session logged by hand), by day, with the week on top.
export default function StudyPage() {
  const t = useT()
  const { day: dayLabel } = useFormat()
  const { getToken, signOut } = useAuth()
  const [today] = useState(() => localDay())
  const [from, setFrom] = useState(() => addDays(today, -(PAGE_DAYS - 1)))
  const [log, setLog] = useState(null)
  const [message, setMessage] = useState('')
  const [logging, setLogging] = useState(false)
  const options = useLinkOptions(true)

  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
    },
    [signOut],
  )

  // "to" is a day past today: the server's today can be ahead of the reader's.
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const data = await listStudySessions({ from, to: addDays(today, 1) }, await getToken())
        if (live) setLog(data)
      } catch (err) {
        if (live) await handleError(err)
      }
    })()
    return () => {
      live = false
    }
  }, [from, today, getToken, handleError])

  const groups = useMemo(() => (log ? groupStudyLog(log.sessions, log.days) : []), [log])
  const summary = useMemo(() => (log ? weekSummary(log.sessions, log.days, today) : null), [log, today])
  const canGoBack = addDays(from, -PAGE_DAYS) >= addDays(today, -(STUDY_LOG.maxRangeDays - 1))

  const replace = (updated) => setLog((current) => ({ ...current, sessions: current.sessions.map((item) => (item.id === updated.id ? updated : item)) }))
  const drop = (id) => setLog((current) => ({ ...current, sessions: current.sessions.filter((item) => item.id !== id) }))
  const add = (created) => {
    setLog((current) => ({ ...current, sessions: [created, ...current.sessions] }))
    setLogging(false)
  }
  const nameOf = (day) => (day === today ? t('study.today') : day === addDays(today, -1) ? t('study.yesterday') : dayLabel(day, { weekday: 'long', day: 'numeric', month: 'long' }))

  return (
    <AppShell>
      <PageHeader
        kicker={t('study.kicker')}
        title={t('study.title')}
        lead={t('study.lead')}
        actions={
          <>
            <PixelButton onClick={() => setLogging((open) => !open)} aria-expanded={logging} className="px-4 py-3">
              {t('study.log')}
            </PixelButton>
            <PixelButton as={Link} to="/progress" variant="ghost" className="px-4 py-3">
              {t('study.toProgress')}
            </PixelButton>
          </>
        }
      />

      {message && (
        <div className="mt-6">
          <ErrorNotice message={message} />
        </div>
      )}

      {logging && (
        <div className="mt-8">
          <ManualEntryForm today={today} options={options} onLogged={add} onCancel={() => setLogging(false)} onError={handleError} />
        </div>
      )}

      {!log ? (
        <StudyPageSkeleton />
      ) : (
        <>
          <div className="mt-8">
            <WeekSummary summary={summary} />
          </div>

          {groups.length === 0 ? (
            <EmptyLog onLog={() => setLogging(true)} />
          ) : (
            <ol aria-label={t('study.days')} className="mt-10 space-y-10">
              {groups.map((group) => (
                <li key={group.day}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-ink pb-2">
                    <h2 className="font-pixel text-lg font-bold text-ink first-letter:uppercase">{nameOf(group.day)}</h2>
                    <p className="text-sm text-muted">
                      {t('study.dayCounted', { time: formatDuration(group.countedSeconds) })}
                    </p>
                  </div>
                  {group.sessions.length ? (
                    <ul aria-label={t('study.sessionsOf', { day: nameOf(group.day) })} className="mt-3 space-y-3">
                      {group.sessions.map((session) => (
                        <SessionRow key={session.id} session={session} options={options} onSaved={replace} onDeleted={drop} onError={handleError} />
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted">{t('study.noSessions')}</p>
                  )}
                </li>
              ))}
            </ol>
          )}

          <p className="mt-10 text-xs text-muted">{t('study.manualNote')}</p>
          {canGoBack && (
            <PixelButton variant="ghost" onClick={() => setFrom((day) => addDays(day, -PAGE_DAYS))} className="mt-4 px-4 py-3">
              {t('study.older')}
            </PixelButton>
          )}
        </>
      )}
    </AppShell>
  )
}
