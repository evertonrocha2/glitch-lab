import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { blockPerson, getConversationMessages, markConversationRead, sendConversationMessage, unblockPerson } from '../../../lib/api.js'
import { useAuth } from '../../../lib/auth/auth-provider.jsx'
import { useChat } from '../../../lib/chat/use-chat.js'
import { setUnreadMessages } from '../../../lib/chat/unread.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { dmTopic } from '../../../lib/realtime/index.js'
import ErrorNotice from '../../ui/error-notice/error-notice.jsx'
import PixelAvatar from '../../ui/pixel-avatar/pixel-avatar.jsx'
import Skeleton, { Bone, Line } from '../../ui/skeleton/skeleton.jsx'
import ChatComposer from '../chat-composer/chat-composer.jsx'
import ChatLog from '../chat-log/chat-log.jsx'
import MessageActions from '../message-actions/message-actions.jsx'

const BACK = 'inline-flex min-h-10 min-w-10 items-center gap-1 font-label text-xs text-ink hover:text-primary md:hidden'

function ConversationSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('chat.conversation.loading')} className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b-2 border-ink px-3 py-3">
        <Bone className="size-10 border-2 border-ink" />
        <Line className="font-pixel text-lg" width="w-32" />
      </div>
      <div className="flex-1 space-y-3 p-4">
        <Bone className="h-10 w-2/3" />
        <Bone className="ml-auto h-10 w-1/2" />
        <Bone className="h-14 w-3/4" />
      </div>
    </Skeleton>
  )
}

// One conversation: the other person, the messages and the composer. onChange() after anything
// that changes the inbox (a message sent or read, a block).
export default function Conversation({ id, onChange }) {
  const t = useT()
  const { user, getToken } = useAuth()
  const [version, setVersion] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const [notice, setNotice] = useState(null)
  const changed = useRef(onChange)
  changed.current = onChange

  const markRead = useCallback(async () => {
    if (document.hidden) return
    try {
      setUnreadMessages(user.id, await markConversationRead(id, await getToken()))
      changed.current?.()
    } catch {
      // The next visit marks it read.
    }
  }, [id, user.id, getToken])

  const chat = useChat({
    // A block or unblock reloads it all: the other person's messages hide or come back.
    chatKey: `${id}:${version}`,
    topic: dmTopic(id),
    load: (cursor, token) => getConversationMessages(id, cursor, token),
    send: (body, token) => sendConversationMessage(id, body, token),
    onIncoming: (messages) => {
      const last = messages.at(-1)
      setAnnouncement(t('chat.incoming', { name: last.sender.name, text: last.body.slice(0, 140) }))
      markRead()
    },
  })
  const ready = chat.state.status === 'ready'

  useEffect(() => {
    if (ready) markRead()
  }, [ready, markRead])

  useEffect(() => {
    setAnnouncement('')
    setNotice(null)
  }, [id])

  async function send(body) {
    await chat.send(body)
    changed.current?.()
  }

  async function toggleBlock(conversation) {
    if (!conversation.blocked && !window.confirm(t('chat.block.confirm', { name: conversation.other.name }))) return
    try {
      const token = await getToken()
      if (conversation.blocked) await unblockPerson({ conversationId: id }, token)
      else await blockPerson({ conversationId: id }, token)
      setNotice(null)
      setVersion((value) => value + 1)
      changed.current?.()
    } catch (err) {
      setNotice(err.message)
    }
  }

  if (chat.state.status === 'loading') return <ConversationSkeleton />
  if (chat.state.status === 'error') {
    return (
      <div className="p-4">
        <Link to="/messages" className={BACK}>
          {t('chat.conversation.back')}
        </Link>
        <div className="mt-3">
          <ErrorNotice message={chat.state.message} />
        </div>
      </div>
    )
  }

  const { conversation } = chat.state.meta
  const { other } = conversation
  return (
    <section aria-labelledby={`conversation-${id}`} className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b-2 border-ink px-2 py-2 sm:px-3">
        <Link to="/messages" aria-label={t('chat.conversation.back')} className={BACK}>
          <span aria-hidden="true">&lt;</span>
        </Link>
        <PixelAvatar seed={other.avatar.seed} color={other.avatar.color} className="size-10" />
        <div className="min-w-0 flex-1">
          <h2 id={`conversation-${id}`} className="truncate font-pixel text-lg leading-tight font-bold text-ink">
            {other.name}
          </h2>
          {other.isPublic && other.handle && (
            <Link to={`/u/${other.handle}`} className="font-label text-[10px] text-secondary hover:underline">
              @{other.handle}
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => toggleBlock(conversation)}
          className="min-h-10 shrink-0 border-2 border-ink bg-white px-3 font-label text-[10px] text-ink hover:bg-mist"
        >
          {conversation.blocked ? t('chat.block.unblock') : t('chat.block.block')}
        </button>
      </header>
      {notice && (
        <p role="alert" className="border-b-2 border-ink bg-primary-soft px-3 py-2 text-sm text-ink">
          {notice}
        </p>
      )}
      <ChatLog
        className="flex-1"
        label={t('chat.conversation.log', { name: other.name })}
        messages={chat.state.messages}
        hasMore={chat.state.hasMore}
        loadingOlder={chat.loadingOlder}
        onLoadOlder={chat.loadOlder}
        announcement={announcement}
        emptyText={t('chat.conversation.empty', { name: other.name })}
        renderActions={(message) => <MessageActions kind="dm" message={message} canReport={!message.mine} />}
      />
      {conversation.canSend ? (
        <ChatComposer onSend={send} placeholder={t('chat.composer.placeholderDm')} label={t('chat.composer.labelTo', { name: other.name })} />
      ) : (
        <p className="border-t-2 border-ink bg-mist px-4 py-3 text-sm text-muted">{t(`chat.conversation.cant.${conversation.reason ?? 'unavailable'}`)}</p>
      )}
    </section>
  )
}
