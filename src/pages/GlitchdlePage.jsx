import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_GUESSES, MODE_NAMES, MODES, shareText } from '../../shared/riddle/game.js'
import AppShell from '../components/AppShell.jsx'
import ErrorNotice from '../components/ErrorNotice.jsx'
import { Check, ClassicBoard, ErrorBoard, GuessList, Legend, SnippetBoard } from '../components/glitchdle/Boards.jsx'
import LanguagePicker from '../components/glitchdle/LanguagePicker.jsx'
import { CommunityPanel, ResultCard, StatsPanel } from '../components/glitchdle/Panels.jsx'
import { AuthError, getRiddle, guessRiddle } from '../lib/api.js'
import { useAuth } from '../lib/auth/AuthProvider.jsx'
import { formatCountdown } from '../lib/daily.js'
import { useProgress } from '../lib/progress/ProgressProvider.jsx'

const INTRO = {
  classic: 'Guess the language of the day. Every guess shows how its traits compare with the answer.',
  error: 'Which language printed this error? Hints unlock after 3 and 6 wrong guesses.',
  snippet: 'Most of the code is hidden. Each wrong guess shows one more line.',
}

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
  function onKeyDown(event, index) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + MODES.length) % MODES.length
    onPick(MODES[next])
    tabs.current[next]?.focus()
  }
  return (
    <div role="tablist" aria-label="Game modes" className="grid grid-cols-3 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink">
      {MODES.map((mode, index) => {
        const state = modes[mode]
        const selected = mode === active
        const note = state.solved ? `${state.guessCount} ${state.guessCount === 1 ? 'guess' : 'guesses'}` : state.over ? 'missed' : state.guessCount ? `${state.guessCount} tries` : 'new'
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
            className={`min-w-0 px-2 py-2.5 text-left transition-colors sm:px-4 ${selected ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-primary-soft'}`}
          >
            <span className="flex items-center gap-1.5 font-label text-xs sm:text-sm">
              {MODE_NAMES[mode]}
              {state.solved && (
                <>
                  <span className={`grid size-4 place-items-center border-2 ${selected ? 'border-white' : 'border-primary text-primary'}`}>
                    <Check className="size-2" />
                  </span>
                  <span className="sr-only">(solved)</span>
                </>
              )}
            </span>
            <span className={`mt-0.5 block text-[11px] ${selected ? 'text-white/80' : 'text-muted'}`}>{note}</span>
          </button>
        )
      })}
    </div>
  )
}

// Glitchdle: a programming-language riddle a day in three modes, the same for every detective.
export default function GlitchdlePage() {
  const { getToken, signOut } = useAuth()
  const { refresh } = useProgress()
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
      setMessage("Couldn't reach the clipboard. Copy it by hand:\n" + text)
    }
  }

  const state = game && mode ? game.modes[mode] : null
  const msLeft = game ? Date.parse(game.nextResetAt) - now : 0
  const justWon = Boolean(last?.correct && last.mode === mode)

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-label text-xs text-secondary">
            &gt; glitchdle<span className="motion-safe:animate-caret">_</span>
          </p>
          <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">Glitchdle{game ? ` #${game.number}` : ''}</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Name today's programming language from its traits, an error it printed and a hidden snippet. The same riddle for every detective, new at
            midnight, Brasilia time.
          </p>
        </div>
        {game && (
          <p className="border-2 border-ink bg-white px-3 py-2 font-label text-xs text-muted shadow-pixel-muted">
            Next in <span className="text-ink tabular-nums">{formatCountdown(msLeft)}</span>
          </p>
        )}
      </div>

      {message && (
        <div className="mt-6 whitespace-pre-line">
          <ErrorNotice message={message} />
        </div>
      )}

      {!game && !message && (
        <p role="status" className="mt-10 font-label text-xs text-muted">
          Loading today's Glitchdle...
        </p>
      )}

      {game && state && (
        <>
          <div className="mt-8">
            <ModeTabs modes={game.modes} active={mode} onPick={(next) => {
                setMode(next)
                setCopied(false)
              }} />
          </div>

          <section id={`panel-${mode}`} role="tabpanel" aria-labelledby={`tab-${mode}`} className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="max-w-2xl text-sm text-ink">{INTRO[mode]}</p>
              {!state.over && (
                <p className="font-label text-[10px] text-muted">
                  {state.guessesLeft}/{MAX_GUESSES} guesses left
                </p>
              )}
            </div>

            {mode === 'error' && <ErrorBoard state={state} />}
            {mode === 'snippet' && <SnippetBoard state={state} />}

            {state.over ? (
              <ResultCard key={`${game.day}-${mode}`} state={state} justWon={justWon} msLeft={msLeft} onShare={share} copied={copied} />
            ) : (
              <LanguagePicker key={mode} mode={mode} guessed={state.guesses.map((item) => item.id)} onGuess={guess} busy={busy} />
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

          <div className="mt-12 grid grid-cols-[minmax(0,1fr)] items-start gap-8 md:grid-cols-2">
            <StatsPanel stats={game.stats} mode={mode} todayGuesses={state.solved ? state.guessCount : null} />
            <CommunityPanel community={game.community} modes={game.modes} />
          </div>
        </>
      )}
    </AppShell>
  )
}
