import { useEffect, useId, useRef, useState } from 'react'
import { PUZZLE_LANGUAGES } from '../../../../shared/daily.js'
import { AuthError, switchPuzzleLanguage } from '../../../lib/api.js'
import { useAuth } from '../../../lib/auth/auth-provider.jsx'
import { languageName } from '../../../lib/daily.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import Working from '../../ui/working/working.jsx'

// Picks the new language, then asks once more: the switch can't be undone. Writing a port the first
// time is an AI call, so the wait shows the working bug. onClose() when cancelled.
function SwitchDialog({ puzzle, started, onSwitched, onClose }) {
  const t = useT()
  const { getToken, signOut } = useAuth()
  const id = useId()
  const [language, setLanguage] = useState(null)
  const [step, setStep] = useState('pick')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const panel = useRef(null)
  const opener = useRef(document.activeElement)
  const close = useRef(onClose)
  close.current = onClose
  const busy = useRef(false)

  // Focus moves into the dialog and goes back to the button that opened it; Escape closes it
  // unless the switch is already on its way.
  useEffect(() => {
    const back = opener.current
    const onKey = (event) => event.key === 'Escape' && !busy.current && close.current()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      back?.focus?.()
    }
  }, [])

  // Each step starts on its first choice; the confirm step on "Back", so a stray Enter can't switch.
  useEffect(() => {
    panel.current?.querySelector(step === 'pick' ? 'input' : 'button')?.focus()
  }, [step])

  const choices = Object.keys(PUZZLE_LANGUAGES).filter((value) => value !== puzzle.language)
  const name = language && languageName(language)

  async function confirm() {
    if (busy.current) return
    busy.current = true
    setSending(true)
    setError(null)
    try {
      onSwitched(await switchPuzzleLanguage(puzzle.id, language, await getToken()))
    } catch (err) {
      if (err instanceof AuthError) await signOut()
      else setError(err.message)
      busy.current = false
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/40 p-4">
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="w-full max-w-md border-2 border-ink bg-white p-5 shadow-pixel-ink">
        {step === 'pick' ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (language) setStep('confirm')
            }}
          >
            <h2 id={`${id}-title`} className="font-pixel text-xl font-bold text-ink">
              {t('daily.switch.title')}
            </h2>
            <p className="mt-2 text-sm text-muted">{t('daily.switch.lead', { language: languageName(puzzle.language) })}</p>
            <fieldset className="mt-4">
              <legend className="font-label text-xs text-ink">{t('daily.switch.languages')}</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {choices.map((value) => (
                  <label
                    key={value}
                    className={`flex min-h-10 cursor-pointer items-center gap-2.5 border-2 px-2.5 text-sm text-ink has-[:focus-visible]:shadow-pixel ${language === value ? 'border-ink bg-primary-soft' : 'border-line hover:bg-mist'}`}
                  >
                    <input type="radio" name={`${id}-language`} value={value} checked={language === value} onChange={() => setLanguage(value)} className="size-4 accent-primary" />
                    <span className="font-mono">{languageName(value)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <PixelButton variant="ghost" onClick={onClose}>
                {t('daily.switch.cancel')}
              </PixelButton>
              <PixelButton type="submit" disabled={!language}>
                {t('daily.switch.next')}
              </PixelButton>
            </div>
          </form>
        ) : (
          <div>
            <h2 id={`${id}-title`} className="font-pixel text-xl font-bold text-ink">
              {t('daily.switch.confirmTitle', { language: name })}
            </h2>
            <p className="mt-3 border-2 border-ink bg-primary-soft px-3 py-2 text-sm font-semibold text-ink">{t('daily.switch.once')}</p>
            <p className="mt-3 text-sm text-muted">{t(started ? 'daily.switch.keepsOpen' : 'daily.switch.keepsNew', { language: name })}</p>
            {sending && (
              <div className="mt-4">
                <Working label={t('daily.switch.working', { language: name })} />
              </div>
            )}
            {error && (
              <p role="alert" className="mt-4 border-2 border-ink bg-primary-soft px-3 py-2 text-sm text-ink">
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <PixelButton variant="ghost" onClick={() => setStep('pick')} disabled={sending}>
                {t('daily.switch.back')}
              </PixelButton>
              <PixelButton onClick={confirm} disabled={sending}>
                {t('daily.switch.confirm', { language: name })}
              </PixelButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// A daily or global puzzle's language switch: the "Switch language" button while I may still
// switch, the "Switched from Python to JavaScript" note once I did, nothing otherwise.
// puzzle: { id, title, language (the one I'm on), switchedFrom, canSwitch }. started: I already
// have a challenge on it (its code will start over). onSwitched({ puzzle, challenge, switchedFrom }).
export default function SwitchLanguage({ puzzle, started = false, onSwitched, className = '' }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  if (puzzle.switchedFrom) {
    return (
      <p className={`text-xs text-muted ${className}`}>
        {t('daily.switch.note', { from: languageName(puzzle.switchedFrom), to: languageName(puzzle.language) })}
      </p>
    )
  }
  if (!puzzle.canSwitch) return null
  return (
    <>
      <PixelButton
        variant="ghost"
        aria-haspopup="dialog"
        aria-label={t('daily.switch.buttonLabel', { title: puzzle.title })}
        onClick={() => setOpen(true)}
        className={`px-3 ${className}`}
      >
        {t('daily.switch.button')}
      </PixelButton>
      {open && (
        <SwitchDialog
          puzzle={puzzle}
          started={started}
          onClose={() => setOpen(false)}
          onSwitched={(result) => {
            setOpen(false)
            onSwitched(result)
          }}
        />
      )}
    </>
  )
}
