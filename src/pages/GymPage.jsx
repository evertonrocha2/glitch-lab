import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
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

export default function GymPage() {
  const { id } = useParams()
  const { getToken, signOut } = useAuth()
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
    setHintLoading(true)
    try {
      const { hint } = await revealHint(id, await getToken())
      setHints((current) => [...current, hint])
    } catch (err) {
      await handleError(err)
    } finally {
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
      <p className="mt-2 max-w-2xl text-muted">
        This code has one bug of the same kind as your case. Edit it until it works, then submit. The AI checks your fix.
      </p>

      {message && (
        <div className="mt-6">
          <ErrorNotice message={message} />
        </div>
      )}

      {challenge && (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <form onSubmit={submit} className="space-y-6">
            <section aria-labelledby="symptom-title" className="border-2 border-ink bg-ink">
              <h2 id="symptom-title" className="border-b-2 border-white/10 px-4 py-2 font-label text-xs text-white/60">
                What you see when you run it
              </h2>
              <p className="px-4 py-3 font-mono text-sm leading-relaxed text-white">{challenge.symptom}</p>
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
