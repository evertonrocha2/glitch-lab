import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { canSubmit, canVote, EVENT_XP, eventStatus, LINK_KINDS, rankEntries } from '../../shared/events.js'
import ArticleBody from '../components/community/ArticleBody.jsx'
import AuthorChip from '../components/community/AuthorChip.jsx'
import CommunityShell from '../components/community/CommunityShell.jsx'
import ErrorNotice from '../components/ErrorNotice.jsx'
import { Countdown, DateRange, KindChip, StatusChip, useNow } from '../components/events/EventBits.jsx'
import EntryCard from '../components/events/EntryCard.jsx'
import EntryForm from '../components/events/EntryForm.jsx'
import Medal from '../components/events/Medal.jsx'
import OrganizerTools from '../components/events/OrganizerTools.jsx'
import PixelButton from '../components/pixel/PixelButton.jsx'
import PixelCard from '../components/pixel/PixelCard.jsx'
import { AuthError, closeEvent, getEvent, pickWinners, submitEntry, updateEntry, voteEntry } from '../lib/api.js'
import { useAuth } from '../lib/auth/AuthProvider.jsx'
import { useT } from '../lib/i18n/I18nProvider.jsx'
import { useProgress } from '../lib/progress/ProgressProvider.jsx'

function Section({ title, children }) {
  return (
    <section aria-label={title} className="mt-8 first:mt-0">
      <h2 className="font-label text-xs text-secondary">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

// The top three on blocks of different heights: 2nd, 1st, 3rd.
function Podium({ entries }) {
  const t = useT()
  const order = [2, 1, 3].map((place) => entries.find((item) => item.place === place)).filter(Boolean)
  const height = { 1: 'min-h-24', 2: 'min-h-16', 3: 'min-h-12' }
  return (
    <section aria-label={t('events.page.winners')} className="mt-10">
      <h2 className="font-pixel text-2xl font-bold text-ink">{t('events.page.winners')}</h2>
      <ol className="mt-5 grid grid-cols-3 items-end gap-2 sm:gap-4">
        {order.map((entry) => (
          <li key={entry.id} className={`flex min-w-0 flex-col items-center text-center ${entry.place === 1 ? 'order-2' : entry.place === 2 ? 'order-1' : 'order-3'}`}>
            <Medal place={entry.place} className="size-10 sm:size-12" />
            <span className="mt-2 w-full break-words font-pixel text-sm font-bold leading-tight text-ink sm:text-base">{entry.title}</span>
            <span className="w-full truncate text-xs text-muted">{entry.author.name}</span>
            <span
              aria-hidden="true"
              className={`mt-2 grid w-full place-items-center border-2 border-ink font-pixel text-xl font-bold ${height[entry.place]} ${entry.place === 1 ? 'bg-primary text-white' : 'bg-secondary-soft text-secondary'}`}
            >
              {entry.place}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Ranking({ entries }) {
  const t = useT()
  if (!entries.length) return null
  return (
    <PixelCard as="section" tone="muted" aria-label={t('events.page.ranking')} className="p-5">
      <h2 className="font-label text-xs text-secondary">{t('events.page.ranking')}</h2>
      <ol className="mt-3 space-y-2">
        {entries.slice(0, 10).map((entry) => (
          <li key={entry.id} className="flex items-center gap-2 text-sm">
            <span className="w-7 shrink-0 font-pixel font-bold text-ink">#{entry.rank}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{entry.title}</span>
            <span className="shrink-0 font-label text-xs text-muted">{entry.votes}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">{t('events.page.rankingHint')}</p>
    </PixelCard>
  )
}

function Requirements({ requirements }) {
  const t = useT()
  return (
    <ul className="space-y-1.5 text-sm">
      {LINK_KINDS.filter((kind) => requirements[kind] !== 'off').map((kind) => (
        <li key={kind} className="flex items-center justify-between gap-3">
          <span className="text-ink">{t(`events.req.${kind}`)}</span>
          <span className={`font-label text-[10px] ${requirements[kind] === 'required' ? 'text-primary' : 'text-muted'}`}>{t(`events.req.${requirements[kind]}`)}</span>
        </li>
      ))}
    </ul>
  )
}

function Points() {
  const t = useT()
  const rows = [
    [t('events.xp.entry'), `+${EVENT_XP.entry}`],
    [t('events.xp.podium'), `+${EVENT_XP.first} / ${EVENT_XP.second} / ${EVENT_XP.third}`],
    [t('events.xp.vote'), `+${EVENT_XP.voteReceived}`],
    [t('events.xp.host'), `+${EVENT_XP.hosted}`],
  ]
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map(([label, xp]) => (
        <li key={label} className="flex items-baseline justify-between gap-3">
          <span className="text-ink">{label}</span>
          <span className="shrink-0 font-label text-xs text-primary">{xp} XP</span>
        </li>
      ))}
    </ul>
  )
}

// What the viewer can do about entering: sign in, join, edit their entry, or why not.
function EntryPanel({ user, event, status, myEntry, loginLink, onOpen }) {
  const t = useT()
  let body
  if (event.mine) body = <p className="text-sm text-muted">{t('events.page.organizer')}</p>
  else if (myEntry) {
    body = (
      <>
        <p className="break-words font-pixel text-lg font-bold text-ink">{myEntry.title}</p>
        <p className="mt-1 text-xs text-muted">{t('events.entry.votes', { count: myEntry.votes })}</p>
        {canSubmit(status) ? (
          <PixelButton onClick={onOpen} variant="secondary" className="mt-3 w-full">
            {t('events.page.editEntry')}
          </PixelButton>
        ) : (
          <p className="mt-2 text-xs text-muted">{t('events.page.closed')}</p>
        )}
      </>
    )
  } else if (status === 'upcoming') body = <p className="text-sm text-muted">{t('events.page.notStarted')}</p>
  else if (!canSubmit(status)) body = <p className="text-sm text-muted">{t('events.page.closed')}</p>
  else if (!user) {
    body = (
      <PixelButton as={Link} to={loginLink} className="w-full">
        {t('events.page.signInToJoin')}
      </PixelButton>
    )
  } else if (user.isDemo) body = <p className="text-sm text-muted">{t('events.page.demo')}</p>
  else {
    body = (
      <PixelButton onClick={onOpen} className="w-full py-3">
        {t('events.page.join')}
      </PixelButton>
    )
  }
  return (
    <PixelCard as="section" aria-label={t('events.page.yourEntry')} className="p-5">
      <h2 className="font-label text-xs text-secondary">{t('events.page.yourEntry')}</h2>
      <div className="mt-3">{body}</div>
    </PixelCard>
  )
}

// One event: anyone can read it; signed-in people join, vote, and the organizer runs it.
export default function EventPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const t = useT()
  const now = useNow(1000)
  const { user, getToken, signOut } = useAuth()
  const { refresh: refreshProgress } = useProgress()
  const [state, setState] = useState({ status: 'loading' })
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [voting, setVoting] = useState(null)
  const loginLink = `/login?next=${encodeURIComponent(location.pathname)}`
  const userId = user?.id

  useEffect(() => {
    let live = true
    setState({ status: 'loading' })
    ;(async () => {
      try {
        const data = await getEvent(id, userId ? await getToken() : null)
        if (live) setState({ status: 'ready', ...data })
      } catch (err) {
        if (live) setState({ status: 'error', message: err.message })
      }
    })()
    return () => {
      live = false
    }
  }, [id, userId, getToken])

  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) {
        await signOut()
        setMessage(t('events.page.sessionEnded'))
      } else setMessage(err.message)
    },
    [signOut, t],
  )

  // Organizer tools answer with the whole event again.
  async function run(call) {
    setMessage('')
    try {
      const data = await call(await getToken())
      setState({ status: 'ready', ...data })
    } catch (err) {
      await handleError(err)
    }
  }

  async function saveEntry(fields) {
    setMessage('')
    setNotice('')
    try {
      const token = await getToken()
      const mine = state.myEntry
      const saved = mine ? await updateEntry(mine.id, fields, token) : await submitEntry(id, fields, token)
      setState((current) => {
        const others = current.entries.filter((item) => item.id !== saved.id)
        const entries = rankEntries([...others, saved])
        return {
          ...current,
          entries,
          myEntry: entries.find((item) => item.id === saved.id),
          event: mine ? current.event : { ...current.event, entryCount: current.event.entryCount + 1 },
        }
      })
      setFormOpen(false)
      setNotice(mine ? t('events.page.saved') : t('events.page.sent'))
      if (!mine) refreshProgress()
      return true
    } catch (err) {
      await handleError(err)
      return false
    }
  }

  async function vote(entry) {
    if (!user) {
      navigate(loginLink)
      return
    }
    const voted = state.myVotes.includes(entry.id)
    setVoting(entry.id)
    setMessage('')
    try {
      const result = await voteEntry(entry.id, !voted, await getToken())
      setState((current) => {
        const entries = rankEntries(current.entries.map((item) => (item.id === entry.id ? { ...item, votes: result.votes } : item)))
        const myVotes = result.voted ? [...new Set([...current.myVotes, entry.id])] : current.myVotes.filter((value) => value !== entry.id)
        return { ...current, entries, myVotes }
      })
    } catch (err) {
      await handleError(err)
    } finally {
      setVoting(null)
    }
  }

  const { event, entries, myEntry, myVotes } = state
  const status = event ? eventStatus(event, now) : null
  // Signed out, the vote button still shows (it leads to sign in); demos can only look.
  const votingOpen = Boolean(status && canVote(status) && !user?.isDemo)
  const placed = entries?.some((item) => item.place)

  return (
    <CommunityShell>
      <Link to="/events" className="font-label text-xs text-ink hover:text-primary">
        &lt; {t('events.page.all')}
      </Link>

      {state.status === 'loading' && (
        <p role="status" className="mt-8 font-label text-xs text-muted">
          {t('events.page.opening')}
        </p>
      )}
      {state.status === 'error' && (
        <div className="mt-8">
          <ErrorNotice message={state.message} />
        </div>
      )}

      {event && (
        <div className="mt-6">
          <PixelCard as="header" className="relative overflow-hidden p-5 sm:p-8">
            <div aria-hidden="true" className={`absolute top-0 right-0 h-28 w-1/2 opacity-15 ${status === 'live' ? 'dither-primary' : 'dither-secondary'}`} />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <KindChip kind={event.kind} />
                  <StatusChip status={status} />
                  {event.tags.map((tag) => (
                    <span key={tag} className="font-mono text-xs text-primary">
                      #{tag}
                    </span>
                  ))}
                </div>
                <h1 className="mt-4 break-words font-pixel text-3xl font-bold leading-tight text-ink sm:text-4xl">{event.title}</h1>
                <p className="mt-3 max-w-2xl break-words text-ink/80">{event.summary}</p>
                <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
                  <div>
                    <p className="mb-1.5 font-label text-[10px] text-muted">{t('events.page.organizedBy')}</p>
                    <AuthorChip author={event.organizer} size="size-9" />
                  </div>
                  <DateRange event={event} />
                </div>
              </div>
              <div className="border-2 border-ink bg-white p-4 shadow-pixel-ink lg:min-w-64">
                <Countdown event={event} now={now} className="flex-col text-2xl sm:text-3xl" />
                <p className="mt-2 font-label text-xs text-muted">{t('events.card.entries', { count: event.entryCount })}</p>
              </div>
            </div>
          </PixelCard>

          {message && (
            <div className="mt-6">
              <ErrorNotice message={message} />
            </div>
          )}
          {notice && (
            <p role="status" className="mt-6 border-2 border-ink bg-secondary-soft px-4 py-3 text-sm text-ink">
              {notice}
            </p>
          )}

          {/* Phones: what you can do (join, organizer tools) first, then the event, then ranking and rules.
              Wide screens: the event on the left, everything else down the right. */}
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr]">
            <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-1">
              <EntryPanel user={user} event={event} status={status} myEntry={myEntry} loginLink={loginLink} onOpen={() => setFormOpen(true)} />
              {event.mine && (
                <OrganizerTools
                  event={event}
                  status={status}
                  entries={entries}
                  onClose={() => run((token) => closeEvent(event.id, token))}
                  onPick={(winners) => run((token) => pickWinners(event.id, winners, token))}
                />
              )}
            </div>
            <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
              <PixelCard tone="muted" className="p-5 sm:p-8">
                <Section title={t('events.page.about')}>
                  <ArticleBody body={event.description} />
                </Section>
                {event.rules && (
                  <Section title={t('events.page.rules')}>
                    <ArticleBody body={event.rules} />
                  </Section>
                )}
                {event.prizes && (
                  <Section title={t('events.page.prizes')}>
                    <p className="whitespace-pre-line break-words text-ink">{event.prizes}</p>
                  </Section>
                )}
              </PixelCard>

              {placed && <Podium entries={entries} />}

              {formOpen && (
                <div className="mt-10">
                  <EntryForm requirements={event.requirements} entry={myEntry} onSave={saveEntry} onCancel={() => setFormOpen(false)} />
                </div>
              )}

              <section aria-labelledby="entries-title" className="mt-10">
                <h2 id="entries-title" className="font-pixel text-2xl font-bold text-ink">
                  {t('events.page.entries', { count: entries.length })}
                </h2>
                {entries.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">{t('events.page.noEntries')}</p>
                ) : (
                  <ul className="mt-5 grid gap-5 md:grid-cols-2">
                    {entries.map((entry) => (
                      <li key={entry.id} className="flex">
                        <EntryCard entry={entry} voted={myVotes.includes(entry.id)} canVote={votingOpen} busy={voting === entry.id} onVote={() => vote(entry)} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <aside className="min-w-0 space-y-6 self-start lg:col-start-2 lg:row-start-2">
              <Ranking entries={entries} />
              <PixelCard as="section" tone="muted" aria-label={t('events.page.requirements')} className="p-5">
                <h2 className="font-label text-xs text-secondary">{t('events.page.requirements')}</h2>
                <div className="mt-3">
                  <Requirements requirements={event.requirements} />
                </div>
                <h2 className="mt-6 font-label text-xs text-secondary">{t('events.xp.title')}</h2>
                <div className="mt-3">
                  <Points />
                </div>
              </PixelCard>
            </aside>
          </div>
        </div>
      )}
    </CommunityShell>
  )
}
