import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { LIMITS } from '../../../shared/limits.js'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import CodeEditor from '../../components/ui/code-editor/code-editor.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import FixResult from '../../components/gym/fix-result/fix-result.jsx'
import HintList from '../../components/gym/hint-list/hint-list.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import { Line } from '../../components/ui/skeleton/skeleton.jsx'
import Working from '../../components/ui/working/working.jsx'
import { AuthError, checkFix, getChallenge, revealHint } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { saveGymDraft, takeGymDraft } from '../../lib/draft.js'
import { useI18n } from '../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../lib/i18n/labels.js'
import { useProgress } from '../../lib/progress/progress-provider.jsx'
import GymPageSkeleton from './gym-page-skeleton.jsx'

export default function GymPage() {
  const { id } = useParams()
  const { t, locale } = useI18n()
  const labels = useLabels()
  const { getToken, signOut } = useAuth()
  const { refresh: refreshProgress } = useProgress()
  const [challenge, setChallenge] = useState(null)
  const [code, setCode] = useState('')
  const [hints, setHints] = useState([])
  const [hintLoading, setHintLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  // A fix saved before a session expired, read once on mount.
  const [savedFix] = useState(() => takeGymDraft(id))
  // Blocks a second submit before the disabled button re-renders.
  const busy = useRef(false)
  const hintBusy = useRef(false)
  const codeRef = useRef(code)
  codeRef.current = code

  // An expired session signs out (keeping the fix); the route guard brings the person back here after login.
  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) {
        if (codeRef.current) saveGymDraft(id, codeRef.current)
        await signOut()
      } else {
        setMessage(err.message)
      }
    },
    [id, signOut],
  )

  useEffect(() => {
    let alive = true
    getToken()
      .then((token) => getChallenge(id, token))
      .then((loaded) => {
        if (!alive) return
        setChallenge(loaded)
        setCode(savedFix ?? loaded.brokenCode)
        setHints(loaded.hints)
      })
      .catch((err) => alive && handleError(err))
    return () => {
      alive = false
    }
  }, [id, getToken, handleError, savedFix])

  // A daily or global challenge's symptom, title and hints come in the reader's language: after a
  // language switch, read them again and keep the code being written.
  const loadedIn = useRef(locale)
  useEffect(() => {
    if (loadedIn.current === locale) return
    loadedIn.current = locale
    let alive = true
    getToken()
      .then((token) => getChallenge(id, token))
      .then((loaded) => {
        if (!alive) return
        setChallenge(loaded)
        setHints(loaded.hints)
      })
      .catch((err) => alive && handleError(err))
    return () => {
      alive = false
    }
  }, [locale, id, getToken, handleError])

  async function nextHint() {
    if (hintBusy.current) return
    hintBusy.current = true
    setHintLoading(true)
    try {
      const { hint } = await revealHint(id, await getToken())
      setHints((current) => [...current, hint])
    } catch (err) {
      await handleError(err)
    } finally {
      hintBusy.current = false
      setHintLoading(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (busy.current) return
    busy.current = true
    setChecking(true)
    setMessage('')
    setResult(null)
    try {
      setResult(await checkFix(id, code, await getToken()))
      refreshProgress()
    } catch (err) {
      await handleError(err)
    } finally {
      busy.current = false
      setChecking(false)
    }
  }

  const passed = result?.passed === true || challenge?.status === 'passed'
  // Daily and global puzzles have no case: they get their title and lead back to the daily page.
  const puzzle = challenge?.puzzle ?? null
  const back = puzzle ? { to: '/daily', text: t('board.gym.backDaily') } : { to: '/board', text: t('board.gym.backBoard') }
  const prompt = { daily: 'board.gym.promptDaily', global: 'board.gym.promptGlobal' }[puzzle?.kind] ?? 'board.gym.promptGym'

  return (
    <AppShell>
      <Link to={back.to} className="font-label text-xs text-ink hover:text-primary">
        &lt; {back.text}
      </Link>
      <p className="mt-6 font-label text-xs text-secondary">
        &gt; {t(prompt)}
        <span className="motion-safe:animate-caret">_</span>
      </p>
      <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">{puzzle ? puzzle.title : t('board.gym.title')}</h1>
      {challenge?.concept && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          {t('board.gym.training')}
          <span className="bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary">{labels.concept(challenge.concept)}</span>
          {puzzle && (
            <span className="border border-ink bg-white px-1.5 py-0.5 font-label text-[10px] text-ink">{labels.difficulty(puzzle.difficulty).toLowerCase()}</span>
          )}
        </p>
      )}
      {!challenge && !message && <Line className="mt-3 text-sm" width="w-56" />}
      <p className="mt-2 max-w-2xl text-muted">
        {!puzzle && t('board.gym.leadCase')}
        {puzzle?.kind === 'daily' && t('board.gym.leadDaily')}
        {puzzle?.kind === 'global' && t('board.gym.leadGlobal')}
      </p>

      {message && (
        <div className="mt-6">
          <ErrorNotice message={message} />
        </div>
      )}

      {!challenge && !message && <GymPageSkeleton />}

      {challenge?.status === 'passed' && !result && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-2 border-ink bg-secondary-soft p-5 shadow-pixel-secondary">
          <p className="text-ink">
            {puzzle ? t('board.gym.doneDaily') : t('board.gym.doneCase')}
          </p>
          <PixelButton as={Link} to={back.to} variant="secondary">
            {back.text}
          </PixelButton>
        </div>
      )}

      {challenge && (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <form onSubmit={submit} className="space-y-6">
            <section aria-labelledby="symptom-title" className="border-2 border-ink bg-primary-soft">
              <h2 id="symptom-title" className="border-b-2 border-ink bg-primary px-4 py-2 font-label text-xs text-white">
                {t('board.gym.symptom')}
              </h2>
              <p className="flex gap-2.5 px-4 py-3 font-mono text-sm leading-relaxed text-ink">
                <span aria-hidden="true" className="select-none font-bold text-primary">
                  &gt;
                </span>
                <span className="min-w-0 wrap-break-word">{challenge.symptom}</span>
              </p>
            </section>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="fix-input" className="font-label text-xs text-ink">
                  {t('board.gym.yourFix')}
                </label>
                <span className="border border-line bg-white px-1.5 py-0.5 font-mono text-xs text-muted">{challenge.language}</span>
              </div>
              <div className="mt-2">
                <CodeEditor id="fix-input" value={code} onChange={setCode} minLines={6} maxLength={LIMITS.code} readOnly={passed} />
              </div>
            </div>

            {!passed && (
              <PixelButton type="submit" variant="secondary" disabled={checking || code.trim() === ''} className="px-5 py-3">
                {t('board.gym.submit')}
              </PixelButton>
            )}
            {checking && <Working label={t('board.gym.checking')} />}
            {result && <FixResult result={result} back={back} />}
          </form>

          <HintList hints={hints} total={challenge.hintsTotal} onReveal={nextHint} loading={hintLoading} />
        </div>
      )}
    </AppShell>
  )
}
