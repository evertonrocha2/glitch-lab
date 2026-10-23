import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { getMessagingWith, startConversation, unblockPerson } from '../../../lib/api.js'
import { useAuth } from '../../../lib/auth/auth-provider.jsx'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'

// "Send message" on a public profile. Only for a signed-in, real account looking at someone else
// who takes messages; someone I blocked shows "Unblock" instead. Anything else shows nothing.
export default function MessageButton({ handle, className = '' }) {
  const { user, getToken } = useAuth()
  const t = useT()
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const eligible = Boolean(user && !user.isDemo && handle)

  useEffect(() => {
    if (!eligible) return undefined
    let alive = true
    setStatus(null)
    ;(async () => {
      try {
        const found = await getMessagingWith(handle, await getToken())
        if (alive) setStatus(found)
      } catch {
        // No button is better than a broken one.
      }
    })()
    return () => {
      alive = false
    }
  }, [eligible, handle, getToken])

  if (!eligible || !status || (!status.canMessage && !status.blocked)) return null

  async function open() {
    setBusy(true)
    setMessage(null)
    try {
      const token = await getToken()
      if (status.blocked) {
        await unblockPerson({ handle }, token)
        setStatus(await getMessagingWith(handle, token))
        return
      }
      const conversation = status.conversationId ? { id: status.conversationId } : await startConversation(handle, token)
      navigate(`/messages/${conversation.id}`)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex flex-col items-start gap-2 ${className}`}>
      <PixelButton variant={status.blocked ? 'ghost' : 'secondary'} onClick={open} disabled={busy} className="px-4 py-3">
        {status.blocked ? t('chat.button.unblock') : t('chat.button.send')}
      </PixelButton>
      {message && (
        <p role="alert" className="text-sm text-ink">
          {message}
        </p>
      )}
    </div>
  )
}
