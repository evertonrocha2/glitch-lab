import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { INTERROGATION_STEPS, INTERROGATION_XP } from '../../../../shared/interrogation.js'
import { AuthError, getInterrogation } from '../../../lib/api.js'
import { useAuth } from '../../../lib/auth/AuthProvider.jsx'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useExportInterrogation } from '../../../lib/interrogation/useExportInterrogation.js'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import InterrogationTimeline from '../interrogation-timeline/interrogation-timeline.jsx'

// The case drawer's way into the interrogation: start it, pick it up where you left it, or (once
// every step passed) read it back as a timeline and export it as a note.
export default function CaseInterrogation({ item }) {
  const t = useT()
  const { getToken, signOut } = useAuth()
  const [interrogation, setInterrogation] = useState(null)
  const [message, setMessage] = useState('')
  const onError = useCallback(
    async (err) => {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
    },
    [signOut],
  )
  const { exportNote, exporting } = useExportInterrogation({ onError })

  // Extra on the drawer: if it fails to load, the button still works and the page says why.
  useEffect(() => {
    let alive = true
    getToken()
      .then((token) => getInterrogation(item.id, token))
      .then((loaded) => alive && setInterrogation(loaded.interrogation))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [item.id, getToken])

  const step = interrogation?.step ?? 0
  const finished = Boolean(interrogation?.finished)
  const started = (interrogation?.turns.length ?? 0) > 0
  const to = `/interrogate/${item.id}`

  return (
    <section aria-labelledby="case-interrogation-title" className="mt-8 border-2 border-ink bg-white p-5 shadow-pixel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="case-interrogation-title" className="font-label text-xs text-primary">
          {t('interrogation.drawer.title')}
        </h3>
        <span className="text-sm text-muted">
          {finished ? t('interrogation.drawer.done') : started ? t('interrogation.step.number', { number: step + 1, total: INTERROGATION_STEPS.length }) : t('interrogation.drawer.reward', { xp: INTERROGATION_XP })}
        </span>
      </div>

      {finished ? (
        <>
          <div className="mt-4">
            <InterrogationTimeline interrogation={interrogation} headingLevel="h4" id="case-interrogation-timeline" />
          </div>
          <PixelButton variant="secondary" onClick={() => exportNote(item, interrogation)} disabled={exporting} className="mt-5">
            {exporting ? t('interrogation.exporting') : t('interrogation.export')}
          </PixelButton>
        </>
      ) : (
        <>
          <p className="mt-3 text-ink">{t('interrogation.drawer.text')}</p>
          <PixelButton as={Link} to={to} className="mt-4">
            {started ? t('interrogation.drawer.resume') : t('interrogation.drawer.start')}
          </PixelButton>
        </>
      )}
      {message && (
        <p role="alert" className="mt-3 text-sm text-ink">
          {message}
        </p>
      )}
    </section>
  )
}
