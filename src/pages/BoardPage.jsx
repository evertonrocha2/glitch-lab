import { useCallback, useEffect, useRef, useState } from 'react'
import AppShell from '../components/AppShell.jsx'
import Board from '../components/board/Board.jsx'
import CaseDrawer from '../components/board/CaseDrawer.jsx'
import ErrorForm from '../components/ErrorForm.jsx'
import ErrorNotice from '../components/ErrorNotice.jsx'
import PixelCard from '../components/pixel/PixelCard.jsx'
import Working from '../components/pixel/Working.jsx'
import { AuthError, analyzeError, listCases } from '../lib/api.js'
import { useAuth } from '../lib/auth/AuthProvider.jsx'
import { saveDraft, takeDraft } from '../lib/draft.js'

export default function BoardPage() {
  const { getToken, signOut } = useAuth()
  const [draft] = useState(() => takeDraft())
  const [cases, setCases] = useState(null)
  const [investigating, setInvestigating] = useState(false)
  const [message, setMessage] = useState('')
  const [openId, setOpenId] = useState(null)
  const [formKey, setFormKey] = useState(0)
  // Guards against double submits even before the disabled button re-renders.
  const busy = useRef(false)

  // An expired session signs out; the route guard then sends the person to login and back here.
  const recoverFromAuth = useCallback(
    async (err, pasted) => {
      if (!(err instanceof AuthError)) return false
      if (pasted) saveDraft(pasted)
      await signOut()
      return true
    },
    [signOut],
  )

  const investigate = useCallback(
    async (input) => {
      if (busy.current) return
      busy.current = true
      setInvestigating(true)
      setMessage('')
      try {
        const saved = await analyzeError(input, await getToken())
        setCases((current) => [saved, ...(current ?? [])])
        setOpenId(saved.id)
        setFormKey((key) => key + 1)
      } catch (err) {
        if (!(await recoverFromAuth(err, input))) setMessage(err.message)
      } finally {
        busy.current = false
        setInvestigating(false)
      }
    },
    [getToken, recoverFromAuth],
  )

  useEffect(() => {
    let alive = true
    getToken()
      .then(listCases)
      .then((list) => alive && setCases((current) => [...(current ?? []), ...list.filter((item) => !current?.some((c) => c.id === item.id))]))
      .catch(async (err) => {
        if (alive && !(await recoverFromAuth(err))) {
          setMessage(err.message)
          setCases((current) => current ?? [])
        }
      })
    return () => {
      alive = false
    }
  }, [getToken, recoverFromAuth])

  // The error pasted on the landing gets investigated as soon as the board opens.
  useEffect(() => {
    if (draft) investigate(draft)
  }, [draft, investigate])

  const closeDrawer = useCallback(() => setOpenId(null), [])
  const openCase = cases?.find((item) => item.id === openId)

  return (
    <AppShell>
      <p className="font-label text-[11px] text-secondary">
        &gt; case board<span className="motion-safe:animate-caret">_</span>
      </p>
      <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">Your case board</h1>
      <p className="mt-2 text-muted">Pick a card and press Train this to enter the gym.</p>

      <PixelCard className="mt-8 p-5 sm:p-6">
        <h2 className="mb-5 font-label text-xs text-primary">Investigate a new error</h2>
        <ErrorForm
          key={formKey}
          onSubmit={investigate}
          loading={investigating}
          initialError={formKey === 0 ? draft?.error : ''}
          initialCode={formKey === 0 ? draft?.code : ''}
        />
      </PixelCard>

      {investigating && (
        <div className="mt-6">
          <Working label="Investigating your error" />
        </div>
      )}
      {message && (
        <div className="mt-6">
          <ErrorNotice message={message} />
        </div>
      )}

      <div className="mt-12">
        {cases === null && (
          <p role="status" className="font-label text-xs text-muted">
            Loading your cases...
          </p>
        )}
        {cases?.length === 0 && !investigating && (
          <p className="mb-5 font-pixel text-lg text-ink">No cases yet. Paste your first error above.</p>
        )}
        <Board cases={cases ?? []} onOpen={(item) => setOpenId(item.id)} />
      </div>

      {openCase && <CaseDrawer item={openCase} onClose={closeDrawer} training={false} />}
    </AppShell>
  )
}
