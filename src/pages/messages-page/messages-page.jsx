import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import Conversation from '../../components/chat/conversation/conversation.jsx'
import Inbox from '../../components/chat/inbox/inbox.jsx'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import { listConversations } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { setUnreadMessages } from '../../lib/chat/unread.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// The inbox checks for new conversations this often while the page is open.
export const INBOX_POLL_MS = 30_000

// Direct messages. Wide screens show the inbox and the open conversation side by side; on a
// phone they're two screens, and the conversation has a back button to the inbox.
export default function MessagesPage() {
  const { id } = useParams()
  const { user, getToken } = useAuth()
  const t = useT()
  const [inbox, setInbox] = useState({ status: 'loading', conversations: [] })
  const latest = useRef(0)

  const loadInbox = useCallback(async () => {
    if (user.isDemo) return setInbox({ status: 'ready', conversations: [] })
    const call = ++latest.current
    try {
      const { conversations, unread } = await listConversations(await getToken())
      if (call !== latest.current) return
      setInbox({ status: 'ready', conversations })
      setUnreadMessages(user.id, unread)
    } catch (err) {
      if (call === latest.current) setInbox((current) => (current.status === 'ready' ? current : { status: 'error', conversations: [], message: err.message }))
    }
  }, [user, getToken])

  useEffect(() => {
    loadInbox()
    const timer = setInterval(() => !document.hidden && loadInbox(), INBOX_POLL_MS)
    return () => clearInterval(timer)
  }, [loadInbox])

  return (
    <AppShell>
      {/* On a phone with a conversation open, the chat gets the whole screen. */}
      <div className={id ? 'hidden md:block' : ''}>
        <PageHeader
          kicker={t('chat.page.kicker')}
          title={t('chat.page.title')}
          lead={t('chat.page.lead')}
          actions={
            <PixelButton as={Link} to="/people" variant="ghost" className="px-4 py-3">
              {t('chat.inbox.findPeople')}
            </PixelButton>
          }
        />
      </div>
      {user.isDemo && (
        <p role="status" className="mt-8 border-2 border-ink bg-secondary-soft px-4 py-3 text-sm text-ink">
          {t('chat.page.demo')}
        </p>
      )}
      <div className={`grid border-2 border-ink bg-white shadow-pixel-ink md:mt-8 md:grid-cols-[18rem_minmax(0,1fr)] ${id ? '' : 'mt-8'}`}>
        <section aria-labelledby="inbox-title" className={`min-h-0 md:max-h-[36rem] md:overflow-y-auto md:border-r-2 md:border-ink ${id ? 'hidden md:block' : ''}`}>
          <h2 id="inbox-title" className="border-b-2 border-ink px-3 py-2 font-label text-xs text-primary">
            {t('chat.inbox.label')}
          </h2>
          <Inbox state={inbox} activeId={id} />
        </section>
        <div className={`h-[calc(100dvh-11rem)] min-h-[22rem] md:h-[36rem] ${id ? '' : 'hidden md:block'}`}>
          {id ? (
            <Conversation key={id} id={id} onChange={loadInbox} />
          ) : (
            <div className="grid h-full place-items-center p-8 text-center">
              <p className="max-w-xs text-sm text-muted">{t('chat.page.pick')}</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
