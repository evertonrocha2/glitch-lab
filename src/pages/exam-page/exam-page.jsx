import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import JoinCard from '../../components/exams/join-card/join-card.jsx'
import TopicRow from '../../components/exams/topic-row/topic-row.jsx'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import { AuthError, getExam, joinTrack } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { localDay } from '../../lib/day.js'
import { useFormat } from '../../lib/i18n/format.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import ExamPageSkeleton from './exam-page-skeleton.jsx'

// /exams/:exam: the exam's areas and topics, each with how the student did. Anyone can look; joining
// the track (with an optional exam date) is one card on top.
export default function ExamPage() {
  const t = useT()
  const { day: dayLabel } = useFormat()
  const { exam: examId } = useParams()
  const { getToken, signOut } = useAuth()
  const [today] = useState(() => localDay())
  const [exam, setExam] = useState(null)
  const [message, setMessage] = useState('')

  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
    },
    [signOut],
  )

  const load = useCallback(async () => setExam(await getExam(examId, await getToken())), [examId, getToken])

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const data = await getExam(examId, await getToken())
        if (live) setExam(data)
      } catch (err) {
        if (live) await handleError(err)
      }
    })()
    return () => {
      live = false
    }
  }, [examId, getToken, handleError])

  async function join({ examDate }) {
    try {
      setMessage('')
      await joinTrack(examId, { examDate }, await getToken())
      await load()
    } catch (err) {
      await handleError(err)
    }
  }

  const name = exam?.name ?? examId.toUpperCase()

  return (
    <AppShell>
      <PageHeader kicker={t('exams.kicker')} title={name} lead={t('exams.lead', { exam: name })}>
        {exam?.examDate && <p className="mt-3 font-label text-xs text-primary">{t('exams.examDate', { date: dayLabel(exam.examDate, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>}
      </PageHeader>

      {message && (
        <div className="mt-6">
          <ErrorNotice message={message} />
        </div>
      )}

      {!exam ? (
        !message && <ExamPageSkeleton />
      ) : (
        <>
          {!exam.joined && (
            <div className="mt-8">
              <JoinCard examName={exam.name} today={today} onJoin={join} />
            </div>
          )}
          <div className="mt-10 space-y-10">
            {exam.areas.map((area) => (
              <section key={area.id} aria-labelledby={`area-${area.id}`}>
                <h2 id={`area-${area.id}`} className="border-b-2 border-ink pb-2 font-pixel text-xl font-bold text-ink">
                  {area.shortName}
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {area.topics.map((topic) => (
                    <TopicRow key={topic.id} examId={exam.id} topic={topic} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </AppShell>
  )
}
