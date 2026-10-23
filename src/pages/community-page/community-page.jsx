import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import ChatComposer from '../../components/chat/chat-composer/chat-composer.jsx'
import ChatLog from '../../components/chat/chat-log/chat-log.jsx'
import CommunityBadge from '../../components/chat/community-badge/community-badge.jsx'
import { TopicChips } from '../../components/chat/community-card/community-card.jsx'
import MessageActions from '../../components/chat/message-actions/message-actions.jsx'
import CommunityShell from '../../components/layout/community-shell/community-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PixelAvatar from '../../components/ui/pixel-avatar/pixel-avatar.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import Skeleton, { Bone, Line, Lines } from '../../components/ui/skeleton/skeleton.jsx'
import {
  deleteCommunityMessage,
  getCommunity,
  getCommunityMessages,
  joinCommunity,
  leaveCommunity,
  postCommunityMessage,
  removeCommunityMember,
} from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { useChat } from '../../lib/chat/use-chat.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { communityTopic } from '../../lib/realtime/index.js'

function CommunitySkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('chat.community.loading')} className="grid gap-6">
      <div className="flex items-start gap-4 border-2 border-ink bg-white p-5 shadow-pixel-ink">
        <Bone className="size-16 border-2 border-ink" />
        <div className="min-w-0 flex-1">
          <Line className="font-pixel text-3xl" width="w-1/2" />
          <Lines count={2} className="text-sm" />
        </div>
      </div>
      <Bone className="h-80 border-2 border-ink" />
    </Skeleton>
  )
}

function Members({ members, isOwner, onRemove }) {
  const t = useT()
  return (
    <ul aria-label={t('chat.community.membersList')} className="divide-y-2 divide-line">
      {members.map((member) => (
        <li key={member.id ?? `${member.person.handle}-${member.joinedAt}`} className="flex min-h-14 items-center gap-3 px-3 py-2">
          <PixelAvatar seed={member.person.avatar.seed} color={member.person.avatar.color} className="size-8" />
          <span className="min-w-0 flex-1">
            {member.person.isPublic && member.person.handle ? (
              <Link to={`/u/${member.person.handle}`} className="block truncate text-sm font-semibold text-ink hover:text-primary">
                {member.person.name}
              </Link>
            ) : (
              <span className="block truncate text-sm font-semibold text-ink">{member.person.name}</span>
            )}
            {member.role === 'owner' && <span className="font-label text-[10px] text-secondary">{t('chat.community.owner')}</span>}
          </span>
          {isOwner && member.role !== 'owner' && member.id && (
            <button
              type="button"
              onClick={() => onRemove(member)}
              aria-label={t('chat.community.removeSr', { name: member.person.name })}
              className="min-h-10 shrink-0 border-2 border-ink bg-white px-2 font-label text-[10px] text-ink hover:bg-mist"
            >
              {t('chat.community.remove')}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function CommunityChat({ slug, detail, onPosted }) {
  const t = useT()
  const { user, getToken } = useAuth()
  const [announcement, setAnnouncement] = useState('')
  const [notice, setNotice] = useState(null)
  const chat = useChat({
    chatKey: slug,
    topic: communityTopic(detail.community.id),
    load: (cursor, token) => getCommunityMessages(slug, cursor, token),
    send: (body, token) => postCommunityMessage(slug, body, token),
    onIncoming: (messages) => {
      const last = messages.at(-1)
      setAnnouncement(t('chat.incoming', { name: last.sender.name, text: last.body.slice(0, 140) }))
    },
  })

  async function remove(message) {
    if (!window.confirm(t('chat.actions.deleteConfirm'))) return
    try {
      await deleteCommunityMessage(message.id, await getToken())
      chat.remove(message.id)
      setNotice(null)
    } catch (err) {
      setNotice(err.message)
    }
  }

  const canReport = (message) => Boolean(user && !user.isDemo && !message.mine)
  return (
    <div className="flex h-[min(70dvh,36rem)] min-h-[22rem] flex-col">
      {notice && (
        <p role="alert" className="border-b-2 border-ink bg-primary-soft px-3 py-2 text-sm text-ink">
          {notice}
        </p>
      )}
      {chat.state.status === 'loading' && (
        <Skeleton label={t('chat.community.chatLoading')} className="space-y-3 p-4">
          <Bone className="h-10 w-2/3" />
          <Bone className="ml-auto h-10 w-1/2" />
        </Skeleton>
      )}
      {chat.state.status === 'error' && (
        <div className="p-4">
          <ErrorNotice message={chat.state.message} />
        </div>
      )}
      {chat.state.status === 'ready' && (
        <ChatLog
          className="flex-1"
          label={t('chat.community.log', { name: detail.community.name })}
          messages={chat.state.messages}
          hasMore={chat.state.hasMore}
          loadingOlder={chat.loadingOlder}
          onLoadOlder={chat.loadOlder}
          announcement={announcement}
          emptyText={t('chat.community.empty')}
          renderActions={(message) => (
            <MessageActions kind="community" message={message} canReport={canReport(message)} onDelete={message.canDelete ? remove : undefined} />
          )}
        />
      )}
      {detail.canPost ? (
        <ChatComposer
          onSend={async (body) => {
            await chat.send(body)
            onPosted?.()
          }}
          placeholder={t('chat.composer.placeholderCommunity')}
          label={t('chat.composer.labelIn', { name: detail.community.name })}
        />
      ) : (
        <p className="border-t-2 border-ink bg-mist px-4 py-3 text-sm text-muted">
          {!user ? t('chat.community.signInToChat') : user.isDemo ? t('chat.community.demo') : detail.membership?.role === 'removed' ? t('chat.community.removed') : t('chat.community.joinToChat')}
        </p>
      )}
    </div>
  )
}

// One community: who it's for, its chat and its members. Readable signed out.
export default function CommunityPage() {
  const { slug } = useParams()
  const location = useLocation()
  const { user, getToken } = useAuth()
  const t = useT()
  const [state, setState] = useState({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  // Phones show the chat or the members; wide screens show both.
  const [tab, setTab] = useState('chat')

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', detail: await getCommunity(slug, await getToken()) })
    } catch (err) {
      setState({ status: 'error', message: err.message })
    }
  }, [slug, getToken])

  useEffect(() => {
    setState({ status: 'loading' })
    load()
  }, [load])

  async function act(action) {
    setBusy(true)
    setNotice(null)
    try {
      const token = await getToken()
      const detail = action === 'join' ? await joinCommunity(slug, token) : await leaveCommunity(slug, token)
      setState({ status: 'ready', detail })
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeMember(member) {
    if (!window.confirm(t('chat.community.removeConfirm', { name: member.person.name }))) return
    try {
      await removeCommunityMember(slug, member.id, await getToken())
      await load()
    } catch (err) {
      setNotice(err.message)
    }
  }

  if (state.status === 'loading') {
    return (
      <CommunityShell>
        <CommunitySkeleton />
      </CommunityShell>
    )
  }
  if (state.status === 'error') {
    return (
      <CommunityShell>
        <ErrorNotice message={state.message} />
        <Link to="/communities" className="mt-4 inline-flex min-h-10 items-center font-label text-xs text-primary underline underline-offset-4">
          {t('chat.community.all')}
        </Link>
      </CommunityShell>
    )
  }

  const { detail } = state
  const { community, membership } = detail
  const isOwner = membership?.role === 'owner'
  const isMember = isOwner || membership?.role === 'member'
  let action = null
  if (!user) {
    action = (
      <PixelButton as={Link} to={`/login?next=${encodeURIComponent(location.pathname)}`} className="px-5 py-3">
        {t('chat.community.signInToJoin')}
      </PixelButton>
    )
  } else if (!user.isDemo && !isOwner && membership?.role !== 'removed') {
    action = (
      <PixelButton variant={isMember ? 'ghost' : 'primary'} onClick={() => act(isMember ? 'leave' : 'join')} disabled={busy} className="px-5 py-3">
        {isMember ? t('chat.community.leave') : t('chat.community.join')}
      </PixelButton>
    )
  }

  return (
    <CommunityShell>
      <Link to="/communities" className="inline-flex min-h-10 items-center font-label text-xs text-secondary hover:underline">
        &lt; {t('chat.community.all')}
      </Link>
      <header className="mt-3 flex flex-col gap-5 border-2 border-ink bg-white p-5 shadow-pixel-ink sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
          <CommunityBadge color={community.color} icon={community.icon} className="size-14 sm:size-16" />
          <div className="min-w-0">
            <h1 className="font-pixel text-2xl font-bold wrap-break-word text-ink sm:text-3xl">{community.name}</h1>
            <p className="mt-1 font-label text-[10px] text-muted">
              {t('chat.communities.members', { count: community.memberCount })} · {t('chat.community.by', { name: community.owner.name })}
            </p>
            {community.description && <p className="mt-3 max-w-2xl text-sm whitespace-pre-wrap wrap-break-word text-muted">{community.description}</p>}
            <TopicChips topics={community.topics} className="mt-3" />
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {notice && (
        <div className="mt-4">
          <ErrorNotice message={notice} />
        </div>
      )}

      <div role="group" aria-label={t('chat.community.view')} className="mt-6 flex border-2 border-ink bg-white lg:hidden">
        {['chat', 'members'].map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-10 flex-1 px-3 py-2 font-label text-xs ${tab === id ? 'bg-primary text-white' : 'text-ink hover:bg-mist'}`}
          >
            {id === 'chat' ? t('chat.community.chat') : t('chat.community.membersTab', { count: community.memberCount })}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-6 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <section aria-labelledby="chat-title" className={`border-2 border-ink bg-white shadow-pixel-ink ${tab === 'chat' ? '' : 'hidden lg:block'}`}>
          <h2 id="chat-title" className="border-b-2 border-ink px-3 py-2 font-label text-xs text-primary">
            {t('chat.community.chat')}
          </h2>
          <CommunityChat slug={slug} detail={detail} />
        </section>
        <section aria-labelledby="members-title" className={`border-2 border-ink bg-white shadow-pixel-ink ${tab === 'members' ? '' : 'hidden lg:block'}`}>
          <h2 id="members-title" className="border-b-2 border-ink px-3 py-2 font-label text-xs text-primary">
            {t('chat.community.membersTab', { count: community.memberCount })}
          </h2>
          <Members members={detail.members} isOwner={isOwner} onRemove={removeMember} />
        </section>
      </div>
    </CommunityShell>
  )
}
