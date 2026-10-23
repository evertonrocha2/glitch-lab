import { useState } from 'react'
import { Link } from 'react-router'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// sharing.status: 'ready' (public profile, can share), 'private' (profile not public), 'demo' or 'loading'.
// Turning a note on needs 'ready'; turning it off always works, so nothing stays shared by accident.
export default function ShareToggle({ noteId, isPublic, sharing, onShare }) {
  const t = useT()
  const [on, setOn] = useState(isPublic)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canShare = sharing.status === 'ready'

  async function change(next) {
    setOn(next)
    setBusy(true)
    setError('')
    try {
      await onShare(next)
    } catch (err) {
      setOn(!next)
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  let hint
  if (error) hint = <span className="text-primary">{error}</span>
  else if (sharing.status === 'demo') hint = t('notes.share.demo')
  else if (sharing.status === 'loading') hint = t('notes.share.loading')
  else if (sharing.status === 'private') {
    hint = (
      <>
        {t('notes.share.private')}{' '}
        <Link to="/profile" className="text-secondary underline underline-offset-2 hover:text-primary">
          {t('notes.share.toProfile')}
        </Link>
      </>
    )
  } else if (on) {
    hint = (
      <>
        {t('notes.share.on')}{' '}
        <Link to={`/u/${sharing.handle}/notes/${noteId}`} className="text-secondary underline underline-offset-2 hover:text-primary">
          {t('notes.share.view')}
        </Link>
      </>
    )
  } else hint = t('notes.share.off')

  return (
    <div className={`mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-2 px-3 py-2.5 ${on && canShare ? 'border-ink bg-secondary-soft' : 'border-line bg-mist'}`}>
      <label className={`flex items-center gap-2.5 ${busy || (!on && !canShare) ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <input
          type="checkbox"
          role="switch"
          checked={on}
          disabled={busy || (!on && !canShare)}
          onChange={(event) => change(event.target.checked)}
          aria-describedby={`share-hint-${noteId}`}
          className="peer sr-only"
        />
        {/* A pixel switch: the knob sits left when off, right (and purple) when on. */}
        <span
          aria-hidden="true"
          className="flex h-6 w-11 shrink-0 items-center border-2 border-ink bg-white p-0.5 peer-checked:justify-end peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-secondary peer-disabled:opacity-50"
        >
          <span className={`size-4 border-2 border-ink ${on ? 'bg-white' : 'bg-ink'}`} />
        </span>
        <span className="font-label text-[10px] text-ink">{t('notes.share.switch')}</span>
      </label>
      <p id={`share-hint-${noteId}`} aria-live="polite" className="min-w-0 text-xs text-muted">
        {hint}
      </p>
    </div>
  )
}
