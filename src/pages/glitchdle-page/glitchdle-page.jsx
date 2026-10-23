import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_GUESSES, MODES, shareText } from '../../../shared/riddle/game.js'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import { Check, ClassicBoard, ErrorBoard, GuessList, Legend, SnippetBoard } from '../../components/glitchdle/boards/boards.jsx'
import LanguagePicker from '../../components/glitchdle/language-picker/language-picker.jsx'
import { CommunityPanel, DistributionPanel, ResultCard, StatsPanel } from '../../components/glitchdle/panels/panels.jsx'
import { AuthError, getRiddle, guessRiddle } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { formatCountdown } from '../../lib/daily.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../lib/i18n/labels.js'
import { useProgress } from '../../lib/progress/progress-provider.jsx'
import GlitchdlePageSkeleton, { CountdownSkeleton } from './glitchdle-page-skeleton.jsx'

function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

// What the share text needs: guesses per mode and the Classic grid, first guess on top.
const shareModes = (modes) =>
  Object.fromEntries(
    MODES.map((mode) => {
      const state = modes[mode]
      const rows = mode === 'classic' ? [...state.guesses].reverse().map((guess) => guess.cells.map((cell) => cell.status)) : undefined
      return [mode, { solved: state.solved, over: state.over, guesses: state.guessCount, rows }]
    }),
  )

function ModeTabs({ modes, active, onPick }) {
  const tabs = useRef([])
  const t = useT()
  const labels = useLabels()
  function onKeyDown(event, index) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + MODES.length) % MODES.length
    onPick(MODES[next])
    tabs.current[next]?.focus()
  }
  return (
    <div role="tablist" aria-label={t('app.glitchdle.modes')} className="grid grid-cols-3 gap-[2px] border-b-2 border-ink bg-ink">
      {MODES.map((mode, index) => {
        const state = modes[mode]
        const selected = mode === active
        const fresh = !state.over && !state.guessCount
        const note = state.solved
          ? t('app.glitchdle.guesses', { count: state.guessCount })
          : state.over
            ? t('app.glitchdle.missed')
            : state.guessCount
              ? t('app.glitchdle.tries', { count: state.guessCount })
              : t('app.glitchdle.new')
        return (
          <button
            key={mode}
            ref={(element) => {
              tabs.current[index] = element
            }}
            type="button"
            role="tab"
            id={`tab-${mode}`}
            aria-selected={selected}
            aria-controls={`panel-${mode}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onPick(mode)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`min-w-0 px-3 py-2.5 text-left transition-colors focus-visible:relative focus-visible:z-10 sm:px-5 ${selected ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-primary-soft'}`}
          >
            <span className="flex items-center gap-1.5 font-label text-xs sm:text-sm">
              {labels.glitchdleMode(mode)}
              {state.solved && (
                <>
                  <span className={`grid size-4 place-items-center border-2 ${selected ? 'border-white' : 'border-primary text-primary'}`}>
                    <Check className="size-2" />
                  </span>
                  <span className="sr-only">{t('app.glitchdle.solvedSr')}</span>
                </>
              )}
            </span>
            {/* An unplayed mode gets a small "new" pill, the same height as the text line it replaces. */}
            <span className="mt-1 flex h-4 items-center">
              {fresh ? (
                <span className={`px-1 font-label text-[10px] leading-4 ${selected ? 'bg-white/20 text-white' : 'bg-secondary-soft text-secondary'}`}>{note}</span>
              ) : (
                <span className={`truncate text-xs leading-4 ${selected ? 'text-white/80' : 'text-muted'}`}>{note}</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Glitchdle: a programming-language riddle a day in three modes, the same for every player.
export default function GlitchdlePage() {
  const { getToken, signOut } = useAuth()
  const { refresh } = useProgress()
  const t = useT()
  const [game, setGame] = useState(null)
  const [mode, setMode] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)
  const [copied, setCopied] = useState(false)
  const sending = useRef(false)
  const now = useNow()

  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
    },
    [signOut],
  )

  const load = useCallback(async () => {
    try {
      const next = await getRiddle(await getToken())
      setGame(next)
      // Open on the first mode still to play.
      setMode((current) => current ?? MODES.find((item) => !next.modes[item].over) ?? 'classic')
    } catch (err) {
      await handleError(err)
    }
  }, [getToken, handleError])

  useEffect(() => {
    load()
  }, [load])

  // At midnight in Brasilia the countdown hits zero: fetch the new game (once).
  const reloadedFor = useRef(null)
  useEffect(() => {
    if (!game || Date.parse(game.nextResetAt) > now || reloadedFor.current === game.nextResetAt) return
    reloadedFor.current = game.nextResetAt
    setMode(null)
    setLast(null)
    load()
  }, [game, now, load])

  async function guess(id) {
    if (sending.current) return
    sending.current = true
    setBusy(true)
    setMessage('')
    setCopied(false)
    try {
      const next = await guessRiddle({ mode, guess: id, day: game.day }, await getToken())
      setGame(next)
      setLast({ mode, id, correct: next.correct })
      // XP and maybe a badge: let the header and the toasts know.
      if (next.correct) refresh()
    } catch (err) {
      await handleError(err)
      // The day turned or another tab guessed: show the board as it really is.
      if (!(err instanceof AuthError)) load()
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  async function share() {
    const text = shareText({ number: game.number, modes: shareModes(game.modes), url: `${window.location.origin}/glitchdle` })
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setMessage(`${t('app.glitchdle.clipboard')}\n${text}`)
    }
  }

  const state = game && mode ? game.modes[mode] : null
  const msLeft = game ? Date.parse(game.nextResetAt) - now : 0
  const justWon = Boolean(last?.correct && last.mode === mode)

  return (
    <AppShell>
      <div>
        <p className="font-label text-xs text-secondary">
          &gt; glitchdle<span className="motion-safe:animate-caret">_</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h1 className="font-pixel text-3xl font-bold text-ink sm:text-4xl">Glitchdle{game ? ` #${game.number}` : ''}</h1>
          {game && (
            <p className="border-2 border-ink bg-white px-3 py-2 font-label text-xs text-muted shadow-pixel-muted">
              {t('app.glitchdle.nextIn')} <span className="text-ink tabular-nums">{formatCountdown(msLeft)}</span>
            </p>
          )}
          {!game && !message && <CountdownSkeleton />}
        </div>
        <p className="mt-2 max-w-2xl text-muted">{t('app.glitchdle.lead')}</p>
      </div>

      {message && (
        <div className="mt-6 whitespace-pre-line">
          <ErrorNotice message={message} />
        </div>
      )}

      {!game && !message && <GlitchdlePageSkeleton />}

      {game && state && (
        // The game on the left; my numbers and today's community in a sidebar on wide screens, below on phones.
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="border-2 border-ink bg-white shadow-pixel-ink">
            <ModeTabs
              modes={game.modes}
              active={mode}
              onPick={(next) => {
                setMode(next)
                setCopied(false)
              }}
            />

            <section id={`panel-${mode}`} role="tabpanel" aria-labelledby={`tab-${mode}`} className="space-y-4 p-4 sm:p-5">
              <p className="max-w-2xl text-sm text-ink">{t(`app.glitchdle.intro.${mode}`)}</p>

              {mode === 'error' && <ErrorBoard state={state} />}
              {mode === 'snippet' && <SnippetBoard state={state} />}

              {state.over ? (
                <ResultCard key={`${game.day}-${mode}`} state={state} justWon={justWon} msLeft={msLeft} onShare={share} copied={copied} />
              ) : (
                <LanguagePicker
                  key={mode}
                  mode={mode}
                  guessed={state.guesses.map((item) => item.id)}
                  onGuess={guess}
                  busy={busy}
                  left={state.guessesLeft}
                  max={MAX_GUESSES}
                />
              )}

              {mode === 'classic' ? (
                <>
                  <Legend />
                  <ClassicBoard guesses={state.guesses} animateId={last?.mode === 'classic' ? last.id : null} />
                </>
              ) : (
                <GuessList guesses={state.guesses} animateId={last?.mode === mode ? last.id : null} />
              )}
            </section>
          </div>

          {/* Sticky only when the whole sidebar fits on screen, so its bottom is never out of reach. */}
          <aside aria-label={t('app.glitchdle.sidebar')} className="space-y-6 lg:[@media(min-height:860px)]:sticky lg:[@media(min-height:860px)]:top-6">
            <StatsPanel stats={game.stats} />
            <DistributionPanel stats={game.stats} mode={mode} todayGuesses={state.solved ? state.guessCount : null} />
            <CommunityPanel community={game.community} modes={game.modes} />
          </aside>
        </div>
      )}
    </AppShell>
  )
}
