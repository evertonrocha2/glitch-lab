import { useCallback, useEffect, useRef, useState } from 'react'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import HuntLeaderboard from '../../components/hunt/hunt-leaderboard/hunt-leaderboard.jsx'
import HuntRound from '../../components/hunt/hunt-round/hunt-round.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import { AuthError, getHunt, getPracticeSnippet, sendHunt } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/AuthProvider.jsx'
import { formatCountdown } from '../../lib/daily.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../lib/i18n/labels.js'
import { useProgress } from '../../lib/progress/ProgressProvider.jsx'

const MODES = ['daily', 'practice']

function ModeTabs({ mode, onPick, locked }) {
  const t = useT()
  const tabs = useRef([])
  function onKeyDown(event, index) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step || locked) return
    event.preventDefault()
    const next = (index + step + MODES.length) % MODES.length
    onPick(MODES[next])
    tabs.current[next]?.focus()
  }
  return (
    <div role="tablist" aria-label={t('hunt.tabs')} className="inline-grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink">
      {MODES.map((item, index) => {
        const selected = item === mode
        return (
          <button
            key={item}
            ref={(element) => {
              tabs.current[index] = element
            }}
            type="button"
            role="tab"
            id={`hunt-tab-${item}`}
            aria-selected={selected}
            aria-controls="hunt-panel"
            tabIndex={selected ? 0 : -1}
            disabled={locked && !selected}
            onClick={() => onPick(item)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`min-h-10 px-4 font-label text-xs transition-colors focus-visible:relative focus-visible:z-10 disabled:cursor-not-allowed disabled:text-muted ${selected ? 'bg-primary text-white' : 'bg-white text-ink enabled:hover:bg-primary-soft'}`}
          >
            {t(`hunt.tab.${item}`)}
          </button>
        )
      })}
    </div>
  )
}

function Rules() {
  const t = useT()
  return (
    <ul className="space-y-2 text-sm text-ink">
      {['hunt.intro.rule1', 'hunt.intro.rule2', 'hunt.intro.rule3'].map((key) => (
        <li key={key} className="flex gap-2">
          <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 bg-primary" />
          <span>{t(key)}</span>
        </li>
      ))}
    </ul>
  )
}

function Intro({ onStart, busy }) {
  const t = useT()
  return (
    <section aria-labelledby="hunt-intro-title" className="relative overflow-hidden border-2 border-ink bg-white shadow-pixel">
      <span aria-hidden="true" className="dither-primary absolute inset-y-0 right-0 w-1/2 opacity-20" />
      <div className="relative border-b-2 border-ink bg-secondary px-5 py-2 font-label text-xs text-white">{t('hunt.intro.kicker')}</div>
      <div className="relative p-5 sm:p-6">
        <h2 id="hunt-intro-title" className="font-pixel text-2xl font-bold text-ink sm:text-3xl">
          {t('hunt.intro.title')}
        </h2>
        <p className="mt-2 text-muted">{t('hunt.intro.lead')}</p>
        <div className="mt-5">
          <Rules />
        </div>
        <p className="mt-4 text-sm text-muted">{t('hunt.intro.keys')}</p>
        <PixelButton onClick={onStart} disabled={busy} className="mt-6 px-6 py-3">
          {t('hunt.start')}
        </PixelButton>
      </div>
    </section>
  )
}

function Done({ data, now, onPractice }) {
  const t = useT()
  const labels = useLabels()
  const { run } = data
  const stats = [
    { label: t('hunt.score'), value: run.score, tone: 'text-primary' },
    { label: t('hunt.done.lines'), value: `${run.correct}/${data.rounds}`, tone: 'text-secondary' },
    { label: t('hunt.done.xp'), value: `+${run.xp}`, tone: 'text-ink' },
    { label: t('hunt.done.rank'), value: data.you ? `#${data.you.rank}` : '-', tone: 'text-ink', note: data.you ? t('hunt.done.rankOf', { players: data.players }) : null },
  ]
  return (
    <section aria-labelledby="hunt-done-title" className="space-y-6">
      <div className="border-2 border-ink bg-white shadow-pixel">
        <div className="border-b-2 border-ink bg-primary px-5 py-2 font-label text-xs text-white">{t('hunt.done.kicker')}</div>
        <div className="p-5 sm:p-6">
          <h2 id="hunt-done-title" className="font-pixel text-2xl font-bold text-ink sm:text-3xl">
            {t('hunt.done.title')}
          </h2>
          {run.correct === data.rounds && <p className="mt-2 font-semibold text-primary">{t('hunt.done.perfect')}</p>}
          <ul className="mt-5 grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink sm:grid-cols-4">
            {stats.map((item) => (
              <li key={item.label} className="min-w-0 bg-white px-3 py-3">
                <span className="font-label text-[10px] text-muted">{item.label}</span>
                <strong className={`mt-1 block font-pixel text-2xl font-bold leading-none tabular-nums ${item.tone}`}>{item.value}</strong>
                {item.note && <span className="text-xs text-muted">{item.note}</span>}
              </li>
            ))}
          </ul>
          {data.isDemo && <p className="mt-3 text-sm text-muted">{t('hunt.done.unranked')}</p>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="font-label text-xs text-muted">{t('hunt.done.next', { time: formatCountdown(Date.parse(data.nextResetAt) - now) })}</p>
            <PixelButton variant="secondary" onClick={onPractice}>
              {t('hunt.done.practice')}
            </PixelButton>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-label text-xs text-ink">{t('hunt.done.recap')}</h3>
        <ol className="mt-3 border-2 border-ink bg-white">
          {run.results.map((item) => (
            <li key={item.index} className="flex items-start gap-3 border-b-2 border-ink px-3 py-2.5 last:border-b-0">
              <span className="w-5 shrink-0 pt-0.5 font-label text-xs text-muted">{item.index + 1}</span>
              <span className="min-w-0 flex-1">
                <strong className={`block text-sm ${item.correct ? 'text-secondary' : 'text-ink'}`}>
                  {item.correct ? t('hunt.result.right') : item.timedOut ? t('hunt.result.timeout') : t('hunt.result.wrong')}
                </strong>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs text-muted">{t('hunt.result.line', { line: item.answer })}</span>
                  <span className="font-label text-[10px] text-primary">{labels.concept(item.concept)}</span>
                </span>
              </span>
              <span className={`shrink-0 pt-0.5 text-right font-label text-xs tabular-nums ${item.points > 0 ? 'font-bold text-secondary' : 'text-muted'}`}>+{item.points}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// Practice: pool snippets on the same 20-second clock, graded by the server, nothing saved.
function Practice({ getToken, onError }) {
  const t = useT()
  const [snippet, setSnippet] = useState(null)
  const [roundMs, setRoundMs] = useState(20_000)
  const [deadline, setDeadline] = useState(0)
  const [picked, setPicked] = useState(null)
  const [result, setResult] = useState(null)
  const [tally, setTally] = useState({ right: 0, played: 0 })
  const [busy, setBusy] = useState(false)

  async function another() {
    setBusy(true)
    try {
      const next = await getPracticeSnippet(snippet?.id, await getToken())
      setSnippet(next.snippet)
      setRoundMs(next.roundMs)
      setDeadline(Date.now() + next.roundMs)
      setPicked(null)
      setResult(null)
    } catch (err) {
      await onError(err)
    } finally {
      setBusy(false)
    }
  }

  async function pick(line) {
    if (!snippet || picked !== null || result) return
    setPicked(line)
    try {
      const answer = await sendHunt('practice', { id: snippet.id, line }, await getToken())
      setResult(answer.result)
      setTally((value) => ({ right: value.right + (answer.result.correct ? 1 : 0), played: value.played + 1 }))
    } catch (err) {
      setPicked(null)
      await onError(err)
    }
  }

  if (!snippet) {
    return (
      <section aria-labelledby="hunt-practice-title" className="border-2 border-ink bg-white p-5 shadow-pixel-secondary sm:p-6">
        <h2 id="hunt-practice-title" className="font-pixel text-2xl font-bold text-ink">
          {t('hunt.practice.title')}
        </h2>
        <p className="mt-2 text-muted">{t('hunt.practice.lead')}</p>
        <PixelButton variant="secondary" onClick={another} disabled={busy} className="mt-6 px-6 py-3">
          {t('hunt.practice.start')}
        </PixelButton>
      </section>
    )
  }
  const phase = result ? 'revealed' : picked !== null ? 'sending' : 'playing'
  return (
    <HuntRound
      kicker={`${t('hunt.practice.tag')} · ${tally.right}/${tally.played}`}
      snippet={snippet}
      deadline={deadline}
      totalMs={roundMs}
      phase={phase}
      picked={result ? result.picked : picked}
      result={result}
      onPick={pick}
      onExpire={() => pick(null)}
      actionLabel={t('hunt.practice.another')}
      onAction={another}
      busy={busy}
    />
  )
}

// Ticks once a second for the countdown to the next hunt.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

// Line hunt: 8 snippets a day, the same for everyone, 20 seconds each to tap the line with the bug.
// The server times every round; this page only shows the clock.
export default function HuntPage() {
  const { getToken, signOut } = useAuth()
  const { refresh } = useProgress()
  const t = useT()
  const now = useNow()
  const [mode, setMode] = useState('daily')
  const [data, setData] = useState(null)
  const [deadline, setDeadline] = useState(0)
  const [picked, setPicked] = useState(null)
  // Right after the last answer, its result stays on screen until "See my result".
  const [reviewing, setReviewing] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)

  const apply = useCallback((next) => {
    setData(next)
    if (next.run?.current) setDeadline(Date.now() + next.run.current.remainingMs)
  }, [])

  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
    },
    [signOut],
  )

  const load = useCallback(async () => {
    try {
      apply(await getHunt(await getToken()))
    } catch (err) {
      await handleError(err)
    }
  }, [apply, getToken, handleError])

  useEffect(() => {
    load()
  }, [load])

  // One request at a time; a refused one (the round ran out, a new day) reloads the real state.
  async function act(action, fields = {}) {
    if (sending.current) return null
    sending.current = true
    setBusy(true)
    setMessage('')
    try {
      const next = await sendHunt(action, { ...fields, day: data?.day }, await getToken())
      apply(next)
      return next
    } catch (err) {
      await handleError(err)
      if (!(err instanceof AuthError)) await load()
      return null
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  async function pick(line) {
    const current = data?.run?.current
    if (!current || sending.current) return
    setPicked(line)
    const next = await act('answer', { index: current.index, line })
    setPicked(null)
    if (next?.run?.finished) {
      setReviewing(true)
      refresh()
    }
  }

  const run = data?.run
  const current = run?.current
  const last = run?.results.at(-1)
  const playing = Boolean(current)
  const showRound = current || (run && !run.finished && last) || (reviewing && last)

  let panel = null
  if (data && mode === 'practice') panel = <Practice getToken={getToken} onError={handleError} />
  else if (data && !run) panel = <Intro onStart={() => act('start')} busy={busy} />
  else if (data && showRound) {
    const index = current ? current.index : last.index
    const snippet = current ?? last
    panel = (
      <HuntRound
        key={index}
        kicker={t('hunt.round', { n: index + 1, total: data.rounds })}
        score={run.score}
        snippet={snippet}
        deadline={current ? deadline : 0}
        totalMs={data.roundMs}
        phase={current ? (picked !== null ? 'sending' : 'playing') : 'revealed'}
        picked={current ? picked : last.picked}
        result={current ? null : last}
        onPick={pick}
        onExpire={() => pick(null)}
        actionLabel={run.finished ? t('hunt.finish') : t('hunt.next')}
        onAction={run.finished ? () => setReviewing(false) : () => act('next')}
        busy={busy}
      />
    )
  } else if (data && run?.finished) panel = <Done data={data} now={now} onPractice={() => setMode('practice')} />

  return (
    <AppShell>
      <PageHeader kicker={t('hunt.kicker')} title={t('hunt.title')} lead={t('hunt.lead')} actions={data && <ModeTabs mode={mode} onPick={setMode} locked={playing} />} />

      {message && (
        <div className="mt-8">
          <ErrorNotice message={message} />
        </div>
      )}

      {!data && !message && (
        <p role="status" className="mt-8 font-label text-xs text-muted">
          {t('hunt.loading')}
        </p>
      )}

      {data && (
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div id="hunt-panel" role="tabpanel" aria-labelledby={`hunt-tab-${mode}`} className="min-w-0">
            {panel}
          </div>
          <aside className="space-y-6">
            <HuntLeaderboard entries={data.leaderboard} you={data.you} />
            {/* The intro already lists the rules. */}
            {(run || mode === 'practice') && (
              <section aria-labelledby="hunt-how-title" className="border-2 border-ink bg-mist p-4">
                <h2 id="hunt-how-title" className="font-label text-xs text-ink">
                  {t('hunt.how.title')}
                </h2>
                <div className="mt-3">
                  <Rules />
                </div>
              </section>
            )}
          </aside>
        </div>
      )}
    </AppShell>
  )
}
