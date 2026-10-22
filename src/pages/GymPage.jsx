import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { conceptLabel } from '../../shared/concepts.js'
import { LIMITS } from '../../shared/limits.js'
import AppShell from '../components/AppShell.jsx'
import CodeEditor from '../components/CodeEditor.jsx'
import ErrorNotice from '../components/ErrorNotice.jsx'
import FixResult from '../components/gym/FixResult.jsx'
import HintList from '../components/gym/HintList.jsx'
import PixelButton from '../components/pixel/PixelButton.jsx'
import Working from '../components/pixel/Working.jsx'
import { AuthError, checkFix, getChallenge, revealHint } from '../lib/api.js'
import { useAuth } from '../lib/auth/AuthProvider.jsx'
import { saveGymDraft, takeGymDraft } from '../lib/draft.js'
import { useProgress } from '../lib/progress/ProgressProvider.jsx'

export default function GymPage() {
  const { id } = useParams()
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

  return (
    <AppShell>
      <Link to="/board" className="font-label text-xs text-ink hover:text-primary">
        &lt; Back to board
      </Link>
      <p className="mt-6 font-label text-xs text-secondary">
        &gt; gym<span className="motion-safe:animate-caret">_</span>
      </p>
      <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">Fix the bug</h1>
      {challenge?.concept && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          Training
          <span className="bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary">{conceptLabel(challenge.concept)}</span>
        </p>
      )}
      <p className="mt-2 max-w-2xl text-muted">
        This code has one bug of the same kind as your case. Edit it until it works, then submit. The AI checks your fix.
      </p>

      {message && (
        <div className="mt-6">
          <ErrorNotice message={message} />
        </div>
      )}

      {!challenge && !message && (
        <p role="status" className="mt-8 font-label text-xs text-muted">
          Loading your challenge...
        </p>
      )}

      {challenge?.status === 'passed' && !result && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-2 border-ink bg-secondary-soft p-5 shadow-pixel-secondary">
          <p className="text-ink">You already fixed this one. Head back to the board to train again.</p>
          <PixelButton as={Link} to="/board" variant="secondary">
            Back to board
          </PixelButton>
        </div>
      )}

      {challenge && (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <form onSubmit={submit} className="space-y-6">
            <section aria-labelledby="symptom-title" className="border-2 border-ink bg-primary-soft">
              <h2 id="symptom-title" className="border-b-2 border-ink bg-primary px-4 py-2 font-label text-xs text-white">
                What you see when you run it
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
                  Your fix
                </label>
                <span className="border border-line bg-white px-1.5 py-0.5 font-mono text-xs text-muted">{challenge.language}</span>
              </div>
              <div className="mt-2">
                <CodeEditor id="fix-input" value={code} onChange={setCode} minLines={6} maxLength={LIMITS.code} readOnly={passed} />
              </div>
            </div>

            {!passed && (
              <PixelButton type="submit" variant="secondary" disabled={checking || code.trim() === ''} className="px-5 py-3">
                Submit fix
              </PixelButton>
            )}
            {checking && <Working label="Checking your fix" />}
            {result && <FixResult result={result} />}
          </form>

          <HintList hints={hints} total={challenge.hintsTotal} onReveal={nextHint} loading={hintLoading} />
        </div>
      )}
    </AppShell>
  )
}
