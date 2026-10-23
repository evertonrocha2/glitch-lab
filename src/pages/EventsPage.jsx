import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { cleanQuery } from '../../shared/community.js'
import { EVENT_TABS } from '../../shared/events.js'
import CommunityShell from '../components/community/CommunityShell.jsx'
import ErrorNotice from '../components/ErrorNotice.jsx'
import EventCard from '../components/events/EventCard.jsx'
import { useNow } from '../components/events/EventBits.jsx'
import PixelButton from '../components/pixel/PixelButton.jsx'
import { listEvents } from '../lib/api.js'
import { useAuth } from '../lib/auth/AuthProvider.jsx'
import { useT } from '../lib/i18n/I18nProvider.jsx'

const EMPTY = { status: 'loading', events: [], page: 1, hasMore: false }

// Community events by tab (live, upcoming, ended), searchable. Filters live in the address, so a
// search can be shared. Works signed out.
export default function EventsPage() {
  const { user } = useAuth()
  const t = useT()
  const now = useNow(1000)
  const [params, setParams] = useSearchParams()
  const q = cleanQuery(params.get('q') ?? '')
  const tab = EVENT_TABS.includes(params.get('tab')) ? params.get('tab') : 'live'
  const [typed, setTyped] = useState(q)
  const [state, setState] = useState(EMPTY)
  const [loadingMore, setLoadingMore] = useState(false)
  const latest = useRef(0)

  useEffect(() => setTyped(q), [q])

  useEffect(() => {
    const call = ++latest.current
    setState(EMPTY)
    listEvents({ q, tab, page: 1 })
      .then(({ events, hasMore }) => call === latest.current && setState({ status: 'ready', events, page: 1, hasMore }))
      .catch((err) => call === latest.current && setState({ ...EMPTY, status: 'error', message: err.message }))
  }, [q, tab])

  const setFilter = useCallback(
    (changes) => {
      setParams((current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (!value || (key === 'tab' && value === 'live')) next.delete(key)
          else next.set(key, value)
        }
        return next
      })
    },
    [setParams],
  )

  async function loadMore() {
    const call = latest.current
    setLoadingMore(true)
    try {
      const next = await listEvents({ q, tab, page: state.page + 1 })
      if (call !== latest.current) return
      setState((current) => ({
        ...current,
        events: [...current.events, ...next.events.filter((item) => !current.events.some((seen) => seen.id === item.id))],
        page: current.page + 1,
        hasMore: next.hasMore,
      }))
    } catch (err) {
      if (call === latest.current) setState((current) => ({ ...current, message: err.message }))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <CommunityShell>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <p className="font-label text-xs text-secondary">
            &gt; {t('events.list.prompt')}
            <span className="motion-safe:animate-caret">_</span>
          </p>
          <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">{t('events.list.title')}</h1>
          <p className="mt-2 max-w-xl text-muted">{t('events.list.lede')}</p>
        </div>
        {user ? (
          <PixelButton as={Link} to="/events/new" className="px-5 py-3">
            {t('events.list.create')}
          </PixelButton>
        ) : (
          <PixelButton as={Link} to={`/login?next=${encodeURIComponent('/events/new')}`} className="px-5 py-3">
            {t('events.list.signInToCreate')}
          </PixelButton>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div role="group" aria-label={t('events.list.tabs')} className="flex shrink-0 border-2 border-ink bg-white">
          {EVENT_TABS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setFilter({ tab: id })}
              className={`flex-1 px-3 py-2 font-label text-xs transition-colors sm:flex-none ${tab === id ? 'bg-primary text-white' : 'text-ink hover:bg-mist'}`}
            >
              {t(`events.tab.${id}`)}
            </button>
          ))}
        </div>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            setFilter({ q: cleanQuery(typed) })
          }}
          className="flex min-w-0 flex-1 gap-2"
        >
          <label htmlFor="event-search" className="sr-only">
            {t('events.list.searchLabel')}
          </label>
          <input
            id="event-search"
            type="search"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={t('events.list.searchPlaceholder')}
            maxLength={80}
            className="min-w-0 flex-1 border-2 border-ink bg-white px-3 py-2 text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel"
          />
          <PixelButton type="submit" variant="secondary" className="px-4">
            {t('events.list.search')}
          </PixelButton>
        </form>
      </div>

      <div className="mt-8">
        {state.status === 'loading' && (
          <p role="status" className="font-label text-xs text-muted">
            {t('events.list.loading')}
          </p>
        )}
        {state.status === 'error' && <ErrorNotice message={state.message} />}
        {state.status === 'ready' &&
          (state.events.length === 0 ? (
            <div className="relative grid min-h-40 place-items-center overflow-hidden border-2 border-dashed border-ink/40 p-8 text-center">
              <div aria-hidden="true" className="dither-secondary absolute inset-0 opacity-15" />
              <p className="relative max-w-sm text-muted">{q ? t('events.list.noMatch') : t(`events.list.none.${tab}`)}</p>
            </div>
          ) : (
            <ul aria-label={t('events.list.list')} className="grid gap-5 md:grid-cols-2">
              {state.events.map((event) => (
                <li key={event.id} className="flex">
                  <EventCard event={event} now={now} />
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
              {loadingMore ? t('events.list.loadingMore') : t('events.list.loadMore')}
            </PixelButton>
          </div>
        )}
      </div>
    </CommunityShell>
  )
}
