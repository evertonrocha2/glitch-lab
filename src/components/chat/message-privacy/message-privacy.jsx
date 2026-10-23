import { useEffect, useState } from 'react'
import { MESSAGE_POLICIES } from '../../../../shared/messages.js'
import { getMessageSettings, saveMessageSettings } from '../../../lib/api.js'
import { useAuth } from '../../../lib/auth/auth-provider.jsx'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelCard from '../../ui/pixel-card/pixel-card.jsx'
import { Line } from '../../ui/skeleton/skeleton.jsx'

// "Who can message me", on the profile page. Saved as soon as it's picked, apart from the
// profile form. Demo accounts don't get messages, so they don't see it.
export default function MessagePrivacy() {
  const { user, getToken } = useAuth()
  const t = useT()
  const [value, setValue] = useState(null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!user || user.isDemo) return undefined
    let alive = true
    ;(async () => {
      try {
        const saved = await getMessageSettings(await getToken())
        if (alive) setValue(saved)
      } catch {
        if (alive) setValue('everyone')
      }
    })()
    return () => {
      alive = false
    }
  }, [user, getToken])

  if (!user || user.isDemo) return null

  async function pick(next) {
    const before = value
    setValue(next)
    setStatus('saving')
    setMessage(null)
    try {
      setValue(await saveMessageSettings(next, await getToken()))
      setStatus('saved')
    } catch (err) {
      setValue(before)
      setStatus('idle')
      setMessage(err.message)
    }
  }

  return (
    <PixelCard tone="secondary" className="p-5 sm:p-7">
      <fieldset>
        <legend className="font-label text-xs text-primary">{t('chat.privacy.title')}</legend>
        <p className="mt-1 text-sm text-muted">{t('chat.privacy.hint')}</p>
        {value === null ? (
          <div className="mt-4">
            <Line className="text-sm" width="w-1/2" />
          </div>
        ) : (
          <div className="mt-3 grid gap-1">
            {MESSAGE_POLICIES.map((policy) => (
              <label key={policy} className="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-ink">
                <input type="radio" name="allow-messages" value={policy} checked={value === policy} onChange={() => pick(policy)} className="size-5 accent-primary" />
                {t(`chat.privacy.${policy}`)}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <p role="status" className="mt-2 min-h-4 font-label text-[10px] text-secondary">
        {status === 'saving' ? t('chat.privacy.saving') : status === 'saved' ? t('chat.privacy.saved') : ''}
      </p>
      {message && (
        <p role="alert" className="mt-2 text-sm text-ink">
          {message}
        </p>
      )}
    </PixelCard>
  )
}
