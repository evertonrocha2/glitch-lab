import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import { Countdown, QuestionCard, RevealCard, Scoreboard, TabBanner } from '../../components/duel/play/play.jsx'
import { ResultPanel } from '../../components/duel/result/result.jsx'
import { Invitation, WaitingRoom } from '../../components/duel/waiting/waiting.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import { AuthError, getDuel, sendDuel } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { playerName, secondsUntil } from '../../lib/duel.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useProgress } from '../../lib/progress/progress-provider.jsx'
import { joinDuel, nudgeDuel } from '../../lib/realtime/index.js'
import DuelPageSkeleton from './duel-page-skeleton.jsx'

// While a duel is on, the page asks for its state about once a second, and right when the next
// round opens. A finished duel between people is checked every few seconds for a while, so a
// rematch invitation shows up; everything else stops polling.
// With the realtime channel up, the other page says when it changed something (an answer, a join,
// a tab report), so polling is only the fallback. A waiting room still asks every 2s: a lost nudge
// must not eat the 3-2-1.
export const POLL_MS = 1000
export const REALTIME_POLL_MS = 4000
export const REALTIME_WAITING_POLL_MS = 2000
const FINISHED_POLL_MS = 5000
const FINISHED_POLLS = 24
const TICK_MS = 200

const isLive = (duel) => duel.status === 'waiting' || duel.status === 'active'

// Re-renders every `ms` while active, for the clocks.
function useTicker(active, ms) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setTick((value) => value + 1), ms)
    return () => clearInterval(timer)
  }, [active, ms])
}

function announcementFor(t, duel) {
  if (!duel || duel.status !== 'active' || duel.you === null) return ''
  if (duel.phase === 'round') return t('duel.live.open', { n: duel.current.index + 1, total: duel.roundCount, question: t(`duel.type.${duel.current.type}`) })
  if (duel.phase === 'reveal' && duel.last) {
    const other = duel.you === 0 ? 1 : 0
    return t('duel.live.round', {
      n: duel.last.index + 1,
      mine: duel.last.players[duel.you].points,
      name: playerName(t, duel.players[other]),
      theirs: duel.last.players[other].points,
    })
  }
  if (duel.phase === 'countdown') return t('duel.countdown')
  return ''
}

// One duel: the waiting room, the 3-2-1, the rounds and the result. The server owns the clock;
// this page only shows it (offset by the difference between the two clocks).
export default function DuelPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getToken, signOut } = useAuth()
  const { refresh } = useProgress()
  const t = useT()
  const [duel, setDuel] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)
  const [copied, setCopied] = useState(false)
  const [away, setAway] = useState(false)
  const [pollKey, setPollKey] = useState(0)
  const [giveUp, setGiveUp] = useState(false)
  const [realtime, setRealtime] = useState('off')
  const [online, setOnline] = useState(null)
  const offset = useRef(0)
  const latest = useRef(null)
  const channelRef = useRef(null)
  const finishedPolls = useRef(0)
  const pendingRef = useRef(null)
  const phaseRef = useRef(null)
  const questionRef = useRef(null)
  const resultRef = useRef(null)

  useTicker(Boolean(duel && isLive(duel)), TICK_MS)
  const now = Date.now() + offset.current

  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
    },
    [signOut],
  )

  const apply = useCallback(
    (next) => {
      // An older answer that lands after a newer one (a nudge and a poll crossing) is dropped.
      const current = latest.current
      if (current?.id === next.id && (next.version < current.version || (next.version === current.version && next.now < current.now))) return
      latest.current = next
      offset.current = Date.parse(next.now) - Date.now()
      setDuel(next)
      if (next.id !== id) {
        navigate(`/duel/${next.id}`, { replace: true })
        // Moved into another duel (a quick match that paired up, a rematch): tell whoever waits there.
        nudgeDuel(next.id, next.version)
      }
    },
    [id, navigate],
  )

  const load = useCallback(async () => {
    try {
      apply(await getDuel(id, await getToken()))
    } catch (err) {
      await handleError(err)
      setPollKey((value) => value + 1)
    }
  }, [id, getToken, apply, handleError])
  const loadRef = useRef(load)
  loadRef.current = load

  // A new id (a rematch, a quick match that moved): keep what's shown if it's already that duel.
  useEffect(() => {
    setDuel((current) => (current?.id === id ? current : null))
    finishedPolls.current = 0
    setMessage('')
    setCopied(false)
    setGiveUp(false)
    loadRef.current()
  }, [id])

  // The polling loop: each new state schedules the next request.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pollKey retries after a failed request
  useEffect(() => {
    if (!duel || duel.id !== id) return
    const live = isLive(duel)
    const rematchWatch = duel.status === 'finished' && duel.you !== null && duel.kind !== 'bot' && !duel.rematchId && finishedPolls.current < FINISHED_POLLS
    if (!live && !rematchWatch) return
    let delay = !live ? FINISHED_POLL_MS : realtime !== 'live' ? POLL_MS : duel.status === 'waiting' ? REALTIME_WAITING_POLL_MS : REALTIME_POLL_MS
    const target = live ? (duel.next?.openAt ?? duel.current?.deadline) : null
    if (target) {
      const wait = Date.parse(target) - (Date.now() + offset.current) + 80
      if (wait > 0 && wait < delay) delay = wait
    }
    if (!live) finishedPolls.current += 1
    const timer = setTimeout(() => loadRef.current(), delay)
    return () => clearTimeout(timer)
  }, [duel, id, pollKey, realtime])

  // The realtime channel: a nudge from the other page refetches at once (unless this page already
  // has that version), and presence says if their page is open. Without it, polling does it all.
  useEffect(() => {
    setRealtime('off')
    setOnline(null)
    const channel = joinDuel(id, {
      onChange: (v) => {
        const current = latest.current
        if (v !== null && current?.id === id && current.version >= v) return
        loadRef.current()
      },
      onStatus: setRealtime,
      onPresence: setOnline,
    })
    channelRef.current = channel
    return () => {
      channel.leave()
      channelRef.current = null
    }
  }, [id])
  const seat = duel?.id === id ? duel.you : null
  useEffect(() => {
    channelRef.current?.setSeat(seat)
  }, [seat, id])
  // After a move of mine landed: the other page hears it now instead of on its next poll.
  const tell = useCallback((next) => {
    if (next?.id) channelRef.current?.nudge(next.version)
  }, [])

  const roundIndex = duel?.status === 'active' && duel.phase === 'round' ? duel.current.index : null
  phaseRef.current = duel?.status === 'active' ? duel.phase : null

  // A new round: forget the local "left" mark and move focus to the question.
  useEffect(() => {
    setAway(false)
    if (roundIndex !== null) questionRef.current?.focus()
  }, [roundIndex])

  // The end: focus the result and refresh XP and badges.
  const finishedId = duel?.status === 'finished' ? duel.id : null
  const youPlayed = duel?.you !== null && duel?.you !== undefined
  useEffect(() => {
    if (!finishedId) return
    resultRef.current?.focus()
    if (youPlayed) refresh()
  }, [finishedId, youPlayed, refresh])

  // Tab leave detection: hidden tab or lost window focus, and coming back. The server stamps each
  // report and voids a round I left while it was open. A deterrent, not proof (see clock.js).
  const watchId = duel?.status === 'active' && duel.you !== null ? duel.id : null
  const serverAway = useRef(false)
  serverAway.current = Boolean(duel?.away)
  useEffect(() => {
    if (!watchId) return
    // The server's last word may be the "hidden" a reload sent while unloading.
    let hidden = serverAway.current
    const report = (state) => {
      if ((state === 'hidden') === hidden) return
      hidden = state === 'hidden'
      if (hidden && phaseRef.current === 'round') setAway(true)
      getToken()
        .then((token) => sendDuel('focus', { id: watchId, state }, token, { keepalive: true }))
        .then((result) => {
          if (result?.recorded) channelRef.current?.nudge(null)
        })
        .catch(() => {})
    }
    const onVisibility = () => report(document.visibilityState === 'hidden' ? 'hidden' : 'visible')
    const onBlur = () => report('hidden')
    const onFocus = () => report('visible')
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    // On mount, the page says where it really is when the server thinks otherwise: back after a
    // reload, or opened in a background tab (no blur or visibilitychange would ever tell).
    report(document.visibilityState === 'hidden' ? 'hidden' : 'visible')
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [watchId, getToken])

  const answer = useCallback(
    async (choice) => {
      if (!duel || duel.phase !== 'round' || duel.you === null || duel.current.myChoice || pendingRef.current) return
      pendingRef.current = choice
      setPending(choice)
      setMessage('')
      try {
        const { duel: next } = await sendDuel('answer', { id: duel.id, round: duel.current.index, choice }, await getToken())
        apply(next)
        tell(next)
      } catch (err) {
        await handleError(err)
        loadRef.current()
      } finally {
        pendingRef.current = null
        setPending(null)
      }
    },
    [duel, getToken, apply, handleError, tell],
  )

  // Keys 1 to 4 answer, unless I'm typing somewhere.
  useEffect(() => {
    if (duel?.phase !== 'round' || duel.status !== 'active' || duel.you === null || duel.current.myChoice) return
    const onKey = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      const option = /^[1-9]$/.test(event.key) ? duel.current.options[Number(event.key) - 1] : null
      if (!option) return
      event.preventDefault()
      answer(option.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [duel, answer])

  async function run(action, fields, { leaveTo } = {}) {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const result = await sendDuel(action, fields, await getToken())
      if (result.duel?.id === id) tell(result.duel)
      if (leaveTo) navigate(leaveTo)
      else apply(result.duel)
    } catch (err) {
      await handleError(err)
    } finally {
      setBusy(false)
    }
  }

  const link = duel ? `${window.location.origin}/duel/${duel.id}` : ''
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setMessage(`${t('duel.clipboard')}\n${link}`)
    }
  }

  const me = duel?.you ?? null
  // Their page open or not, from realtime presence: only shown for a person I'm playing.
  const presence = online && realtime === 'live' && me !== null && duel ? duel.players.map((player, index) => (player.bot || index === me ? null : online.has(index))) : null
  const leftNow = Boolean(duel?.status === 'active' && duel.phase === 'round' && (away || (me !== null && duel.current.left[me])))

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-label text-xs text-secondary">
            &gt; duel<span className="motion-safe:animate-caret">_</span>
          </p>
          <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">{t('duel.title')}</h1>
        </div>
        <Link to="/duel" className="font-label text-xs text-secondary hover:text-primary hover:underline">
          &lt; {t('duel.back')}
        </Link>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcementFor(t, duel)}
      </p>

      {message && (
        <div className="mt-6 whitespace-pre-line">
          <ErrorNotice message={message} />
        </div>
      )}

      {!duel && !message && <DuelPageSkeleton />}

      {duel && (
        <div className="mt-8">
          {duel.status === 'waiting' && duel.you !== null && (
            <WaitingRoom
              duel={duel}
              now={now}
              link={link}
              copied={copied}
              onCopy={copyLink}
              busy={busy}
              onBot={() => run('bot', { from: duel.id })}
              onCancel={() => run('leave', { id: duel.id }, { leaveTo: '/duel' })}
            />
          )}
          {duel.status === 'waiting' && duel.joinable && <Invitation duel={duel} busy={busy} onJoin={() => run('join', { id: duel.id })} />}
          {(duel.status === 'cancelled' || (duel.status === 'active' && duel.spectator)) && (
            <PixelCard tone="muted" className="p-5">
              <p className="font-pixel text-xl font-bold text-ink">{duel.status === 'cancelled' ? t('duel.cancelled') : t('duel.spectating')}</p>
              <Link to="/duel" className="mt-3 inline-block font-label text-xs text-secondary hover:underline">
                {t('duel.back')}
              </Link>
            </PixelCard>
          )}

          {duel.status === 'active' && !duel.spectator && (
            <div className="space-y-5">
              <TabBanner left={leftNow} />
              <Scoreboard duel={duel} presence={presence} />
              {duel.phase === 'countdown' && <Countdown seconds={secondsUntil(duel.next.openAt, now)} />}
              {duel.phase === 'round' && <QuestionCard ref={questionRef} duel={duel} now={now} pending={pending} onAnswer={answer} />}
              {duel.phase === 'reveal' && duel.last && <RevealCard duel={duel} now={now} />}
              {me !== null && (
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <PixelButton
                    variant="ghost"
                    disabled={busy}
                    onClick={() => (giveUp ? run('leave', { id: duel.id }) : setGiveUp(true))}
                    className="px-3 py-1.5 text-[10px]"
                  >
                    {giveUp ? t('duel.giveUpSure') : t('duel.giveUp')}
                  </PixelButton>
                </div>
              )}
            </div>
          )}

          {duel.status === 'finished' && (
            <ResultPanel
              ref={resultRef}
              duel={duel}
              busy={busy}
              copied={copied}
              onShare={copyLink}
              onRematch={() => run('rematch', { id: duel.id })}
              onPlayBot={() => run('bot', {})}
            />
          )}
        </div>
      )}
    </AppShell>
  )
}
