import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import LessonView from '../../components/exams/lesson-view/lesson-view.jsx'
import QuestionCard from '../../components/exams/question-card/question-card.jsx'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import { answerExamQuestion, AuthError, listTopicQuestions } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { loadLessons } from '../../lib/exams/lessons.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import ExamTopicPageSkeleton from './exam-topic-page-skeleton.jsx'

const unanswered = (question) => !question.attempt

const TABS = ['lesson', 'questions']

// "Aula" and "Questões". Arrow keys move between them, like the other tab rows in the app.
function TopicTabs({ tab, onPick, tabs }) {
  const t = useT()
  function onKeyDown(event, index) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + TABS.length) % TABS.length
    onPick(TABS[next])
    tabs.current[next]?.focus()
  }
  return (
    <div role="tablist" aria-label={t('exams.lesson.tabs')} className="mt-6 inline-grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink">
      {TABS.map((item, index) => {
        const selected = item === tab
        return (
          <button
            key={item}
            ref={(element) => {
              tabs.current[index] = element
            }}
            type="button"
            role="tab"
            id={`topic-tab-${item}`}
            aria-selected={selected}
            aria-controls="topic-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onPick(item)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`min-h-10 px-5 font-label text-xs transition-colors focus-visible:relative focus-visible:z-10 ${selected ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-primary-soft'}`}
          >
            {t(item === 'lesson' ? 'exams.lesson.tab' : 'exams.lesson.questionsTab')}
          </button>
        )
      })}
    </div>
  )
}

// /exams/:exam/:topic: the topic's lesson (ENEM topics that have one) and its real questions, one at
// a time, starting at the first one the student hasn't answered. Pages load as they're needed. The
// page opens on the lesson until the student answers something here, then on the questions.
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
  // The lesson comes from its own chunk. status: loading | ready | none (no lesson) | error.
  const [lessons, setLessons] = useState(() => ({ status: examId === 'enem' ? 'loading' : 'none', lesson: null }))
  const [lessonTry, setLessonTry] = useState(0)
  const [picked, setPicked] = useState(null)
  const tabs = useRef([])
  const examName = examId.toUpperCase()

  // loading: the error came from loading the topic's questions, where a 404 means the topic itself
  // isn't there (an answer's 404 is about that one question, and says so).
  const handleError = useCallback(
    async (err, { loading = false } = {}) => {
      if (err instanceof AuthError) await signOut()
      else {
        setMessage(err.message)
        if (loading && err.status === 404) setNotFound(true)
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
    loadFrom(1).catch((err) => live && handleError(err, { loading: true }))
    return () => {
      live = false
    }
  }, [loadFrom, handleError])

  // lessonTry: bumped by the retry button, to load the chunk again.
  useEffect(() => {
    if (examId !== 'enem') return
    let live = true
    loadLessons().then(
      ({ lessonFor }) => {
        const lesson = lessonFor(topicId)
        if (live) setLessons({ status: lesson ? 'ready' : 'none', lesson })
      },
      () => live && setLessons({ status: 'error', lesson: null }),
    )
    return () => {
      live = false
    }
  }, [examId, topicId, lessonTry])

  function retryLesson() {
    setLessons({ status: 'loading', lesson: null })
    setLessonTry((count) => count + 1)
  }

  // From the end of the lesson to the questions: focus on "Questões", the tabs back in view. Only
  // this window scrolls, so inside the game's study window the game behind stays put.
  function practice() {
    setPicked('questions')
    const questionsTab = tabs.current[TABS.indexOf('questions')]
    questionsTab?.focus({ preventScroll: true })
    const top = questionsTab?.getBoundingClientRect().top ?? 0
    if (top < 0) window.scrollTo({ top: Math.max(0, window.scrollY + top - 16) })
  }

  async function answer(choice) {
    setMessage('')
    try {
      const { attempt } = await answerExamQuestion(currentId, choice, await getToken())
      setState((current) => ({ ...current, questions: current.questions.map((item) => (item.id === currentId ? { ...item, attempt } : item)) }))
    } catch (err) {
      await handleError(err)
    }
  }

  async function next() {
    setMessage('')
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
      await handleError(err, { loading: true })
    }
  }

  const back = (
    <Link to={`/exams/${examId}`} className="font-label text-xs text-secondary underline-offset-4 hover:underline">
      {t('exams.topic.back', { exam: examName })}
    </Link>
  )
  const index = state ? state.questions.findIndex((item) => item.id === currentId) : -1
  const current = index >= 0 ? state.questions[index] : null

  // The first lesson load decides whether there are tabs, so the page waits for it (a retry doesn't).
  const waiting = (!state && !message) || (lessons.status === 'loading' && lessonTry === 0)
  const withLesson = lessons.status !== 'none' && !waiting
  const answeredAny = state?.questions.some((item) => item.attempt) ?? false
  const tab = withLesson ? (picked ?? (lessons.status === 'ready' && !answeredAny ? 'lesson' : 'questions')) : 'questions'

  const questions = (
    <>
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
          <p className="font-pixel text-xl font-bold text-ink">{withLesson && !state.questions.length ? t('exams.lesson.noQuestions') : t('exams.topic.empty')}</p>
        </PixelCard>
      )}
    </>
  )

  const lesson = (
    <div className="mt-8">
      {lessons.status === 'ready' && <LessonView lesson={lessons.lesson} onPractice={practice} />}
      {lessons.status === 'loading' && <ExamTopicPageSkeleton />}
      {lessons.status === 'error' && (
        <div className="space-y-4">
          <ErrorNotice message={t('exams.lesson.loadError')} />
          <PixelButton variant="ghost" onClick={retryLesson}>
            {t('exams.lesson.retry')}
          </PixelButton>
        </div>
      )}
    </div>
  )

  return (
    <AppShell>
      <div>{back}</div>
      <PageHeader className="mt-4" title={state?.topic.name ?? lessons.lesson?.title ?? ''} kicker={examName}>
        {current && !waiting && tab === 'questions' && (
          <p className="mt-2 text-sm text-muted">{t('exams.topic.progress', { current: index + 1, total: state.questions.length })}</p>
        )}
      </PageHeader>

      {message && (
        <div className="mt-6">
          <ErrorNotice message={notFound ? t('exams.topic.notFound') : message} />
        </div>
      )}

      {waiting && !message && <ExamTopicPageSkeleton />}

      {withLesson ? (
        <>
          <TopicTabs tab={tab} onPick={setPicked} tabs={tabs} />
          <div role="tabpanel" id="topic-panel" aria-labelledby={`topic-tab-${tab}`}>
            {tab === 'lesson' ? lesson : questions}
          </div>
        </>
      ) : (
        !waiting && questions
      )}
    </AppShell>
  )
}
