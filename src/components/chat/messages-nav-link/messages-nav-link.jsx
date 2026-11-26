import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// "Messages" for the app nav, with how many conversations are unread. The nav reads the count once
// (useUnreadMessages) and passes it here, so the row and the "More" menu share one subscription.
export function MessagesNavLabel({ unread }) {
  const t = useT()
  return (
    <>
      {t('chat.nav.messages')}
      {unread > 0 && (
        <>
          <span aria-hidden="true" className="bg-primary px-1 py-0.5 text-[10px] leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
          <span className="sr-only">{t('chat.nav.unread', { count: unread })}</span>
        </>
      )}
    </>
  )
}
