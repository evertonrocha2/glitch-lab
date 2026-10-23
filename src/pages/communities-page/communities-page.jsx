import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { cleanQuery } from '../../../shared/community.js'
import { COMMUNITY_TOPICS, MESSAGE_LIMITS } from '../../../shared/messages.js'
import CommunityCard from '../../components/chat/community-card/community-card.jsx'
import CommunityShell from '../../components/layout/community-shell/community-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import Skeleton, { Bone, Line, Lines } from '../../components/ui/skeleton/skeleton.jsx'
import { listCommunities } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

const EMPTY = { status: 'loading', communities: [], mine: [], page: 1, hasMore: false }
const GRID = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3'

function CommunitiesSkeleton() {
  const t = useT()
  return (
    <Skeleton label={t('chat.communities.loading')} className={GRID}>
      {[1, 2, 3].map((slot) => (
        <div key={slot} className="border-2 border-ink bg-white p-4 shadow-pixel-ink">
          <div className="flex items-start gap-3">
            <Bone className="size-12 border-2 border-ink" />
            <div className="min-w-0 flex-1">
              <Line className="font-pixel text-lg leading-tight" width="w-2/3" />
              <Line className="text-[10px]" width="w-16" />
            </div>
          </div>
          <div className="mt-3">
            <Lines count={2} className="text-sm" />
          </div>
        </div>
      ))}
    </Skeleton>
  )
}

// Communities: search by name or topic, the ones I'm in, and "Create community". Works signed out.
export default function CommunitiesPage() {
  const { user, getToken } = useAuth()
  const t = useT()
  const [params, setParams] = useSearchParams()
  const q = cleanQuery(params.get('q') ?? '').slice(0, MESSAGE_LIMITS.query)
  const topic = COMMUNITY_TOPICS.includes(params.get('topic')) ? params.get('topic') : null
  const [typed, setTyped] = useState(q)
  const [state, setState] = useState(EMPTY)
  const [loadingMore, setLoadingMore] = useState(false)
  const latest = useRef(0)

  useEffect(() => setTyped(q), [q])

  useEffect(() => {
    const call = ++latest.current
    setState(EMPTY)
    getToken()
      .then((token) => listCommunities({ q, topic, page: 1 }, token))
      .then((found) => call === latest.current && setState({ status: 'ready', ...found }))
      .catch((err) => call === latest.current && setState({ ...EMPTY, status: 'error', message: err.message }))
  }, [q, topic, getToken])

  const setFilter = useCallback(
    (changes) =>
      setParams((current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      }),
    [setParams],
  )

  async function loadMore() {
    const call = latest.current
    setLoadingMore(true)
    try {
      const next = await listCommunities({ q, topic, page: state.page + 1 }, await getToken())
      if (call !== latest.current) return
      setState((current) => ({
        ...current,
        communities: [...current.communities, ...next.communities.filter((item) => !current.communities.some((seen) => seen.id === item.id))],
        page: next.page,
        hasMore: next.hasMore,
      }))
    } catch (err) {
      if (call === latest.current) setState((current) => ({ ...current, message: err.message }))
    } finally {
      setLoadingMore(false)
    }
  }

  const create = user ? (
    <PixelButton as={Link} to="/communities/new" className="px-5 py-3">
      {t('chat.communities.create')}
    </PixelButton>
  ) : (
    <PixelButton as={Link} to={`/login?next=${encodeURIComponent('/communities/new')}`} className="px-5 py-3">
      {t('chat.communities.signInToCreate')}
    </PixelButton>
  )

  return (
    <CommunityShell>
      <PageHeader kicker={t('chat.communities.kicker')} title={t('chat.communities.title')} lead={t('chat.communities.lead')} actions={create} />

      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          setFilter({ q: cleanQuery(typed) })
        }}
        className="mt-8 flex gap-2"
      >
        <label htmlFor="community-search" className="sr-only">
          {t('chat.communities.searchLabel')}
        </label>
        <input
          id="community-search"
          type="search"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={t('chat.communities.searchPlaceholder')}
          maxLength={MESSAGE_LIMITS.query}
          className="min-w-0 flex-1 border-2 border-ink bg-white px-3 py-2.5 text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel"
        />
        <PixelButton type="submit" variant="secondary" className="px-4">
          {t('chat.communities.search')}
        </PixelButton>
      </form>

      {/* Topic filters: one row that scrolls sideways on a phone. */}
      <div role="group" aria-label={t('chat.communities.topicFilter')} className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        <button
          type="button"
          aria-pressed={!topic}
          onClick={() => setFilter({ topic: null })}
          className={`min-h-10 shrink-0 border-2 border-ink px-3 font-label text-xs ${!topic ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-mist'}`}
        >
          {t('chat.communities.allTopics')}
        </button>
        {COMMUNITY_TOPICS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={topic === id}
            onClick={() => setFilter({ topic: topic === id ? null : id })}
            className={`min-h-10 shrink-0 border-2 border-ink px-3 font-label text-xs ${topic === id ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-mist'}`}
          >
            {t(`chat.topic.${id}`)}
          </button>
        ))}
      </div>

      {state.status === 'ready' && state.mine.length > 0 && !q && !topic && (
        <section aria-labelledby="mine-title" className="mt-8">
          <h2 id="mine-title" className="font-pixel text-xl font-bold text-ink">
            {t('chat.communities.mine')}
          </h2>
          <ul className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {state.mine.map((item) => (
              <li key={item.id} className="shrink-0">
                <Link to={`/communities/${item.slug}`} className="flex min-h-10 items-center gap-2 border-2 border-ink bg-white px-3 py-2 font-label text-xs text-ink hover:bg-mist">
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="all-title" className="mt-8">
        <h2 id="all-title" className="sr-only">
          {t('chat.communities.all')}
        </h2>
        {state.status === 'loading' && <CommunitiesSkeleton />}
        {state.status === 'error' && <ErrorNotice message={state.message} />}
        {state.status === 'ready' &&
          (state.communities.length === 0 ? (
            <div className="relative grid min-h-40 place-items-center overflow-hidden border-2 border-dashed border-ink/40 p-8 text-center">
              <div aria-hidden="true" className="dither-secondary absolute inset-0 opacity-15" />
              <p className="relative max-w-sm text-muted">{q || topic ? t('chat.communities.noMatch') : t('chat.communities.none')}</p>
            </div>
          ) : (
            <ul aria-label={t('chat.communities.all')} className={GRID}>
              {state.communities.map((item) => (
                <li key={item.id} className="flex">
                  <CommunityCard community={item} />
                </li>
              ))}
            </ul>
          ))}
        {state.status === 'ready' && state.message && (
          <div className="mt-5">
            <ErrorNotice message={state.message} />
          </div>
        )}
        {state.hasMore && (
          <div className="mt-8 text-center">
            <PixelButton variant="ghost" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? t('chat.communities.loadingMore') : t('chat.communities.loadMore')}
            </PixelButton>
          </div>
        )}
      </section>
    </CommunityShell>
  )
}
