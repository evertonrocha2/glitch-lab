import { NavLink } from 'react-router'
import { useUnreadMessages } from '../../../lib/chat/unread.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// "Messages" in the app nav, with how many conversations are unread. className is the nav's own.
export default function MessagesNavLink({ className }) {
  const t = useT()
  const unread = useUnreadMessages()
  return (
    <NavLink to="/messages" className={className}>
      {t('chat.nav.messages')}
      {unread > 0 && (
        <>
          <span aria-hidden="true" className="bg-primary px-1 py-0.5 text-[10px] leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
          <span className="sr-only">{t('chat.nav.unread', { count: unread })}</span>
        </>
      )}
    </NavLink>
  )
}
