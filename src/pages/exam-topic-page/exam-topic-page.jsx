import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import QuestionCard from '../../components/exams/question-card/question-card.jsx'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import { answerExamQuestion, AuthError, listTopicQuestions } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import ExamTopicPageSkeleton from './exam-topic-page-skeleton.jsx'

const unanswered = (question) => !question.attempt

// /exams/:exam/:topic: a topic's real questions, one at a time, starting at the first one the student
// hasn't answered. Pages load as they're needed.
export default function ExamTopicPage() {
  const t = useT()
  const { exam: examId, topic: topicId } = useParams()
  const { getToken, signOut } = useAuth()
  // { topic, questions (every page loaded so far), page, hasMore }
  const [state, setState] = useState(null)
  const [currentId, setCurrentId] = useState(null)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState('')
  const [notFound, setNotFound] = useState(false)
  const examName = examId.toUpperCase()

  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) await signOut()
      else {
        setMessage(err.message)
        if (err.status === 404) setNotFound(true)
      }
    },
    [signOut],
  )

  // Loads pages from `page` on until one has a question left to answer, adding them to `before`.
  const loadFrom = useCallback(
    async (page, before = []) => {
      const token = await getToken()
      let questions = before
      for (let next = page; ; next++) {
        const data = await listTopicQuestions({ examId, topicId, page: next }, token)
        questions = [...questions, ...data.questions]
        const open = data.questions.find(unanswered)
        if (open || !data.hasMore) {
          setState({ topic: data.topic, questions, page: data.page, hasMore: data.hasMore })
          setCurrentId(open?.id ?? null)
          setDone(!open)
          return
        }
      }
    },
    [examId, topicId, getToken],
  )

  useEffect(() => {
    let live = true
    loadFrom(1).catch((err) => live && handleError(err))
    return () => {
      live = false
    }
  }, [loadFrom, handleError])

  async function answer(choice) {
    try {
      const { attempt } = await answerExamQuestion(currentId, choice, await getToken())
      setState((current) => ({ ...current, questions: current.questions.map((item) => (item.id === currentId ? { ...item, attempt } : item)) }))
    } catch (err) {
      await handleError(err)
    }
  }

  async function next() {
    const at = state.questions.findIndex((item) => item.id === currentId)
    const following = state.questions.slice(at + 1).find(unanswered)
    if (following) return setCurrentId(following.id)
    if (!state.hasMore) {
      setCurrentId(null)
      return setDone(true)
    }
    try {
      await loadFrom(state.page + 1, state.questions)
    } catch (err) {
      await handleError(err)
    }
  }

  const back = (
    <Link to={`/exams/${examId}`} className="font-label text-xs text-secondary underline-offset-4 hover:underline">
      {t('exams.topic.back', { exam: examName })}
    </Link>
  )
  const index = state ? state.questions.findIndex((item) => item.id === currentId) : -1
  const current = index >= 0 ? state.questions[index] : null

  return (
    <AppShell>
      <div>{back}</div>
      <PageHeader className="mt-4" title={state?.topic.name ?? ''} kicker={examName}>
        {current && <p className="mt-2 text-sm text-muted">{t('exams.topic.progress', { current: index + 1, total: state.questions.length })}</p>}
      </PageHeader>

      {message && (
        <div className="mt-6">
          <ErrorNotice message={notFound ? t('exams.topic.notFound') : message} />
        </div>
      )}

      {!state && !message && <ExamTopicPageSkeleton />}

      {current && (
        <div className="mt-8">
          <QuestionCard key={current.id} question={current} onAnswer={answer} examName={examName} />
          {current.attempt && (
            <PixelButton onClick={next} className="mt-5 px-5 py-3">
              {t('exams.next')}
            </PixelButton>
          )}
        </div>
      )}

      {done && (
        <PixelCard tone="muted" className="mt-8 p-6 text-center sm:p-10">
          <p className="font-pixel text-xl font-bold text-ink">{t('exams.topic.empty')}</p>
        </PixelCard>
      )}
    </AppShell>
  )
}
