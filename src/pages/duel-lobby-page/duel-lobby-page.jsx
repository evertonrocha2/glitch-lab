import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import { PlayerFace } from '../../components/duel/play/play.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import { AuthError, getDuelLobby, sendDuel } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { playerName } from '../../lib/duel.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { nudgeDuel } from '../../lib/realtime/index.js'
import DuelLobbySideSkeleton from './duel-lobby-page-skeleton.jsx'

function ActionRow({ title, how, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-dashed border-line py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0 flex-1 basis-56">
        <h3 className="font-label text-sm text-ink">{title}</h3>
        <p className="mt-1 text-sm text-muted">{how}</p>
      </div>
      {/* One width for every action, so the buttons line up on the same edge. */}
      <div className="w-full shrink-0 *:w-full sm:w-60">{children}</div>
    </div>
  )
}

function RatingCard({ rating, isDemo }) {
  const t = useT()
  return (
    <PixelCard tone="secondary" className="p-5">
      <h2 className="font-label text-xs text-secondary">{t('duel.rating.title')}</h2>
      <p className="mt-2 font-pixel text-5xl font-bold leading-none text-ink tabular-nums">{rating.rating}</p>
      <p className="mt-2 font-label text-xs text-muted">{t('duel.rating.record', { wins: rating.wins, draws: rating.draws, losses: rating.losses })}</p>
      <p className="mt-3 text-sm text-muted">{isDemo ? t('duel.rating.demo') : t('duel.rating.new')}</p>
    </PixelCard>
  )
}

function RecentDuels({ recent }) {
  const t = useT()
  return (
    <section aria-labelledby="duel-recent">
      <h2 id="duel-recent" className="font-pixel text-xl font-bold text-ink">
        {t('duel.recent.title')}
      </h2>
      {recent.length === 0 ? (
        <p className="mt-3 border-2 border-dashed border-muted/60 bg-white p-4 text-sm text-muted">{t('duel.recent.empty')}</p>
      ) : (
        <ul className="mt-3 border-2 border-ink bg-white shadow-pixel-ink">
          {recent.map((item) => (
            <li key={item.id} className="border-b-2 border-ink last:border-b-0">
              <Link to={`/duel/${item.id}`} className="flex min-w-0 items-center gap-3 px-3 py-2.5 hover:bg-primary-soft">
                <PlayerFace player={item.opponent} className="size-7" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{t('duel.recent.vs', { name: playerName(t, item.opponent) })}</span>
                  <span className={`font-label text-[10px] ${item.outcome === 'win' ? 'text-secondary' : 'text-muted'}`}>{t(`duel.outcome.${item.outcome}`)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <strong className="block font-mono text-sm text-ink tabular-nums">
                    {item.you} - {item.them}
                  </strong>
                  {item.ratingAfter !== null && <span className="font-label text-[10px] text-muted tabular-nums">{item.ratingAfter}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DuelLeaderboard({ entries }) {
  const t = useT()
  return (
    <section aria-labelledby="duel-leaderboard">
      <h2 id="duel-leaderboard" className="font-pixel text-xl font-bold text-ink">
        {t('duel.leaderboard.title')}
      </h2>
      {entries.length === 0 ? (
        <p className="mt-3 border-2 border-dashed border-muted/60 bg-white p-4 text-sm text-muted">{t('duel.leaderboard.empty')}</p>
      ) : (
        <ol aria-label={t('duel.leaderboard.title')} className="mt-3 border-2 border-ink bg-white shadow-pixel-ink">
          {entries.map((entry) => (
            <li key={entry.rank} className={`flex items-center gap-3 border-b-2 border-ink px-3 py-2.5 last:border-b-0 ${entry.isYou ? 'bg-secondary-soft' : ''}`}>
              <span className={`w-8 shrink-0 font-label text-sm ${entry.rank === 1 ? 'text-primary' : 'text-ink'}`}>#{entry.rank}</span>
              <PlayerFace player={entry} className="size-8" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">
                  {entry.handle ? (
                    <Link to={`/u/${entry.handle}`} className="hover:text-primary hover:underline">
                      {entry.name}
                    </Link>
                  ) : (
                    t('player.anonymous')
                  )}
                </span>
                {entry.isYou && <span className="bg-secondary px-1 py-0.5 font-label text-[10px] leading-none text-white">{t('duel.you')}</span>}
              </span>
              <span className="shrink-0 text-right">
                <strong className="block font-mono text-sm text-ink tabular-nums">{entry.rating}</strong>
                <span className="text-xs text-muted">{t('duel.leaderboard.wins', { count: entry.wins })}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

// The duel lobby: start a quick match, a private duel or a bot game, join with a code, and see
// my rating, my recent duels and the leaderboard.
export default function DuelLobbyPage() {
  const { getToken, signOut } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const [lobby, setLobby] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')

  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
    },
    [signOut],
  )

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const next = await getDuelLobby(await getToken())
        if (alive) setLobby(next)
      } catch (err) {
        if (alive) await handleError(err)
      }
    })()
    return () => {
      alive = false
    }
  }, [getToken, handleError])

  async function start(action, fields = {}) {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const { duel } = await sendDuel(action, fields, await getToken())
      // I took the empty seat of someone's waiting room: their page hears it now, not on its next poll.
      if (duel.status === 'active' && (action === 'join' || action === 'queue')) nudgeDuel(duel.id, duel.version)
      navigate(`/duel/${duel.id}`)
    } catch (err) {
      await handleError(err)
      setBusy(false)
    }
  }

  function join(event) {
    event.preventDefault()
    start('join', { code })
  }

  return (
    <AppShell>
      <PageHeader kicker={t('duel.nav')} title={t('duel.title')} lead={t('duel.lead')} />

      {message && (
        <div className="mt-8">
          <ErrorNotice message={message} />
        </div>
      )}

      {lobby?.active && (
        <p className="mt-8 flex flex-wrap items-center gap-2 border-2 border-ink bg-primary-soft px-4 py-3 text-sm text-ink shadow-pixel">
          {t('duel.lobby.resume')}
          <Link to={`/duel/${lobby.active.id}`} className="font-label text-xs text-primary underline">
            {t('duel.lobby.resumeLink')}
          </Link>
        </p>
      )}

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-8">
          <PixelCard className="p-5 sm:p-6">
            <h2 className="font-pixel text-xl font-bold text-ink">{t('duel.lobby.play')}</h2>
            <div className="mt-4">
              <ActionRow title={t('duel.lobby.quick')} how={t('duel.lobby.quickHow')}>
                <PixelButton onClick={() => start('queue')} disabled={busy}>
                  {t('duel.lobby.quick')}
                </PixelButton>
              </ActionRow>
              <ActionRow title={t('duel.lobby.private')} how={t('duel.lobby.privateHow')}>
                <PixelButton variant="secondary" onClick={() => start('create')} disabled={busy}>
                  {t('duel.lobby.private')}
                </PixelButton>
              </ActionRow>
              <ActionRow title={t('duel.lobby.bot')} how={t('duel.lobby.botHow')}>
                <PixelButton variant="ghost" onClick={() => start('bot')} disabled={busy}>
                  {t('duel.lobby.bot')}
                </PixelButton>
              </ActionRow>
              <form onSubmit={join} className="pt-4">
                <h3 className="font-label text-sm text-ink">{t('duel.lobby.joinTitle')}</h3>
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <label className="min-w-0 flex-1 basis-40">
                    <span className="sr-only">{t('duel.lobby.joinLabel')}</span>
                    <input
                      value={code}
                      onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 6))}
                      placeholder="ABC234"
                      aria-label={t('duel.lobby.joinLabel')}
                      autoComplete="off"
                      spellCheck={false}
                      className="block w-full border-2 border-ink bg-white px-3 py-2 font-mono text-base tracking-[0.3em] text-ink uppercase placeholder:text-muted/50"
                    />
                  </label>
                  <PixelButton type="submit" variant="ghost" disabled={busy || code.trim().length < 6} className="w-full sm:w-60">
                    {t('duel.lobby.join')}
                  </PixelButton>
                </div>
              </form>
            </div>
          </PixelCard>

          <section aria-labelledby="duel-rules" className="border-2 border-dashed border-ink/40 bg-white p-5">
            <h2 id="duel-rules" className="font-label text-sm text-ink">
              {t('duel.rules.title')}
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted marker:text-primary">
              <li>{t('duel.rules.rounds')}</li>
              <li>{t('duel.rules.points')}</li>
              <li className="text-ink">{t('duel.rules.tab')}</li>
              <li>{t('duel.rules.forfeit')}</li>
            </ul>
          </section>
        </div>

        <div className="min-w-0 space-y-8">
          {lobby && <RatingCard rating={lobby.rating} isDemo={lobby.isDemo} />}
          {lobby && <RecentDuels recent={lobby.recent} />}
          {lobby && <DuelLeaderboard entries={lobby.leaderboard} />}
          {!lobby && !message && <DuelLobbySideSkeleton />}
        </div>
      </div>
    </AppShell>
  )
}
