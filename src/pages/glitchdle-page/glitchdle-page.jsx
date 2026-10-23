import { useCallback, useEffect, useRef, useState } from 'react'
import { CATEGORIES, categoryById, categoryOfSlot } from '../../../shared/riddle/categories.js'
import { MAX_GUESSES } from '../../../shared/riddle/game.js'
import { shareText } from '../../../shared/riddle/share.js'
import { Check, ClassicBoard, ErrorBoard, GuessList, Legend, SnippetBoard } from '../../components/glitchdle/boards/boards.jsx'
import Countdown from '../../components/glitchdle/countdown/countdown.jsx'
import LanguagePicker from '../../components/glitchdle/language-picker/language-picker.jsx'
import { CommunityPanel, DistributionPanel, ResultCard, StatsPanel } from '../../components/glitchdle/panels/panels.jsx'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import { AuthError, getRiddle, guessRiddle } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { dayIn } from '../../lib/i18n/format.js'
import { useI18n, useT } from '../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../lib/i18n/labels.js'
import { useProgress } from '../../lib/progress/progress-provider.jsx'
import GlitchdlePageSkeleton, { CountdownSkeleton } from './glitchdle-page-skeleton.jsx'

// The day as the share text writes it: "23/10" in Portuguese, "Oct 23" in English.
const SHARE_DATE = { 'pt-BR': { day: '2-digit', month: '2-digit' }, en: { month: 'short', day: 'numeric' } }
const LANGUAGE_MODES = categoryById('languages').modes

// One tab's second line: how a board (or a set of boards) is going.
function useBoardNote() {
  const t = useT()
  return (state) => {
    if (state.solved) return t('app.glitchdle.guesses', { count: state.guessCount })
    if (state.over) return t('app.glitchdle.missed')
    if (state.guessCount) return t('app.glitchdle.tries', { count: state.guessCount })
    return null
  }
}

// Arrow keys move between tabs, like a native tab list.
function arrowStep(event) {
  return event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
}

function TabNote({ text, selected }) {
  const t = useT()
  // An unplayed board gets a small "new" pill, the same height as the text line it replaces.
  return (
    <span className="mt-1 flex h-4 items-center">
      {text ? (
        <span className={`truncate text-xs leading-4 ${selected ? 'text-white' : 'text-muted'}`}>{text}</span>
      ) : (
        <span className={`px-1 font-label text-[10px] leading-4 ${selected ? 'bg-white/20 text-white' : 'bg-secondary-soft text-secondary'}`}>{t('app.glitchdle.new')}</span>
      )}
    </span>
  )
}

function SolvedMark({ selected }) {
  const t = useT()
  return (
    <>
      <span className={`grid size-4 place-items-center border-2 ${selected ? 'border-white' : 'border-primary text-primary'}`}>
        <Check className="size-2" />
      </span>
      <span className="sr-only">{t('app.glitchdle.solvedSr')}</span>
    </>
  )
}

// Languages, Frameworks, Databases: a segmented control over the board.
function CategoryTabs({ categories, modes, active, onPick }) {
  const tabs = useRef([])
  const t = useT()
  const note = useBoardNote()
  function onKeyDown(event, index) {
    const step = arrowStep(event)
    if (!step) return
    event.preventDefault()
    const next = (index + step + categories.length) % categories.length
    onPick(categories[next].id)
    tabs.current[next]?.focus()
  }
  return (
    <div role="tablist" aria-label={t('app.glitchdle.categories')} className="grid grid-cols-3 gap-2 sm:gap-3">
      {categories.map((category, index) => {
        const selected = category.id === active
        const states = category.modes.map((mode) => modes[mode]).filter(Boolean)
        const done = states.filter((state) => state.solved).length
        const played = states.some((state) => state.guessCount || state.over)
        const text = states.length > 1 ? (played ? t('app.glitchdle.categorySolved', { done, total: states.length, count: done }) : null) : note(states[0])
        return (
          <button
            key={category.id}
            ref={(element) => {
              tabs.current[index] = element
            }}
            type="button"
            role="tab"
            id={`category-${category.id}`}
            aria-selected={selected}
            aria-controls="glitchdle-board"
            tabIndex={selected ? 0 : -1}
            onClick={() => onPick(category.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`min-w-0 border-2 border-ink px-2 py-2 text-left transition-colors sm:px-4 ${
              selected ? 'bg-primary text-white shadow-pixel-ink' : 'bg-white text-ink shadow-pixel-muted hover:bg-primary-soft'
            }`}
          >
            {/* Wraps instead of cutting the name off on a phone ("Bancos de dados"). */}
            <span className="flex items-start gap-1.5 font-label text-[11px] leading-tight sm:text-sm">
              <span className="min-w-0 wrap-break-word">{t(`app.glitchdle.category.${category.id}`)}</span>
              {done === states.length && done > 0 && <SolvedMark selected={selected} />}
            </span>
            <TabNote text={text} selected={selected} />
          </button>
        )
      })}
    </div>
  )
}

// Classic, Error, Snippet: the three ways to guess the language.
function ModeTabs({ modes, active, onPick }) {
  const tabs = useRef([])
  const t = useT()
  const labels = useLabels()
  const note = useBoardNote()
  function onKeyDown(event, index) {
    const step = arrowStep(event)
    if (!step) return
    event.preventDefault()
    const next = (index + step + LANGUAGE_MODES.length) % LANGUAGE_MODES.length
    onPick(LANGUAGE_MODES[next])
    tabs.current[next]?.focus()
  }
  return (
    <div role="tablist" aria-label={t('app.glitchdle.modes')} className="grid grid-cols-3 gap-[2px] border-b-2 border-ink bg-ink">
      {LANGUAGE_MODES.map((mode, index) => {
        const state = modes[mode]
        const selected = mode === active
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
              {state.solved && <SolvedMark selected={selected} />}
            </span>
            <TabNote text={note(state)} selected={selected} />
          </button>
        )
      })}
    </div>
  )
}

// Where the framework and database data comes from, as the sources ask.
function Credits() {
  const t = useT()
  const link = 'text-secondary underline decoration-2 underline-offset-2 hover:text-primary'
  return (
    <p className="mt-10 border-t-2 border-dashed border-line pt-4 text-xs text-muted">
      {t('app.glitchdle.credits')}{' '}
      <a className={link} href="https://www.wikidata.org" target="_blank" rel="noreferrer">
        Wikidata (CC0)
      </a>
      {', '}
      <a className={link} href="https://stackoverflow.com/tags" target="_blank" rel="noreferrer">
        Stack Overflow (CC BY-SA 4.0)
      </a>
      .
    </p>
  )
}

// Glitchdle: a riddle a day per board, the same for every player: the language in three modes,
// a framework and a database.
export default function GlitchdlePage() {
  const { getToken, signOut } = useAuth()
  const { refresh } = useProgress()
  const { locale } = useI18n()
  const t = useT()
  const labels = useLabels()
  const [game, setGame] = useState(null)
  const [category, setCategory] = useState('languages')
  const [mode, setMode] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)
  const [copied, setCopied] = useState(false)
  const sending = useRef(false)

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
      // Open on the first language mode still to play.
      setMode((current) => current ?? LANGUAGE_MODES.find((item) => !next.modes[item].over) ?? 'classic')
    } catch (err) {
      await handleError(err)
    }
  }, [getToken, handleError])

  useEffect(() => {
    load()
  }, [load])

  // At midnight in Brasilia the day turns: fetch the new game once, from a single timer instead
  // of checking every second.
  const resetAt = game?.nextResetAt
  useEffect(() => {
    if (!resetAt) return
    const timer = setTimeout(
      () => {
        setMode(null)
        setLast(null)
        load()
      },
      Math.max(0, Date.parse(resetAt) - Date.now()) + 500,
    )
    return () => clearTimeout(timer)
  }, [resetAt, load])

  const slot = category === 'languages' ? mode : categoryById(category).modes[0]

  async function guess(id) {
    if (sending.current) return
    sending.current = true
    setBusy(true)
    setMessage('')
    setCopied(false)
    try {
      const next = await guessRiddle({ mode: slot, guess: id, day: game.day }, await getToken())
      setGame(next)
      setLast({ mode: slot, id, correct: next.correct })
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
    const state = game.modes[slot]
    // The grid is the classic board being shared, or the language's Classic for Error and Snippet.
    const gridSlot = categoryOfSlot(slot).id === 'languages' ? 'classic' : slot
    const rows = [...(game.modes[gridSlot]?.guesses ?? [])].reverse().map((item) => item.cells.map((cell) => cell.status))
    const boards = Object.fromEntries(Object.entries(game.modes).map(([key, item]) => [key, { solved: item.solved, over: item.over, guesses: item.guessCount }]))
    const text = shareText({
      t,
      name: (key) => labels.glitchdleMode(key),
      number: game.number,
      date: dayIn(locale, game.day, SHARE_DATE[locale] ?? SHARE_DATE.en),
      boards,
      rows,
      streak: game.stats.streak,
      host: window.location.origin.replace(/^https?:\/\//, ''),
    })
    // Phones get the system share sheet; everything else (or a sheet that fails) copies the text.
    if (navigator.share && window.matchMedia?.('(pointer: coarse)').matches) {
      try {
        await navigator.share({ text })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setMessage(`${t('app.glitchdle.clipboard')}\n${text}`)
    }
  }

  const categories = game ? CATEGORIES.filter((item) => item.modes.some((key) => game.modes[key])) : []
  const state = game && slot ? game.modes[slot] : null
  const active = categoryById(category)
  const justWon = Boolean(last?.correct && last.mode === slot)
  const classic = slot === 'classic' || category !== 'languages'

  function pickCategory(next) {
    setCategory(next)
    setCopied(false)
  }

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
              {t('app.glitchdle.nextIn')} <Countdown resetAt={game.nextResetAt} className="text-ink tabular-nums" />
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
          <div className="space-y-4">
            <CategoryTabs categories={categories} modes={game.modes} active={category} onPick={pickCategory} />

            <div id="glitchdle-board" role="tabpanel" aria-labelledby={`category-${category}`} className="border-2 border-ink bg-white shadow-pixel-ink">
              {category === 'languages' && (
                <ModeTabs
                  modes={game.modes}
                  active={mode}
                  onPick={(next) => {
                    setMode(next)
                    setCopied(false)
                  }}
                />
              )}

              <section
                id={`panel-${slot}`}
                role={category === 'languages' ? 'tabpanel' : 'region'}
                aria-labelledby={category === 'languages' ? `tab-${slot}` : `category-${category}`}
                className="space-y-4 p-4 sm:p-5"
              >
                <p className="max-w-2xl text-sm text-ink">{t(`app.glitchdle.intro.${slot}`)}</p>

                {slot === 'error' && <ErrorBoard state={state} />}
                {slot === 'snippet' && <SnippetBoard state={state} />}

                {state.over ? (
                  <ResultCard key={`${game.day}-${slot}`} state={state} justWon={justWon} resetAt={game.nextResetAt} onShare={share} copied={copied} />
                ) : (
                  <LanguagePicker
                    key={slot}
                    mode={slot}
                    category={category}
                    items={active.items}
                    guessed={state.guesses.map((item) => item.id)}
                    onGuess={guess}
                    busy={busy}
                    left={state.guessesLeft}
                    max={MAX_GUESSES}
                  />
                )}

                {classic ? (
                  <>
                    <Legend ranked={category !== 'languages'} />
                    <ClassicBoard guesses={state.guesses} category={category} attributes={active.attributes} animateId={last?.mode === slot ? last.id : null} />
                  </>
                ) : (
                  <GuessList guesses={state.guesses} animateId={last?.mode === slot ? last.id : null} />
                )}
              </section>
            </div>
          </div>

          {/* Sticky only when the whole sidebar fits on screen, so its bottom is never out of reach. */}
          <aside aria-label={t('app.glitchdle.sidebar')} className="space-y-6 lg:[@media(min-height:860px)]:sticky lg:[@media(min-height:860px)]:top-6">
            <StatsPanel stats={game.stats} />
            <DistributionPanel stats={game.stats} mode={slot} todayGuesses={state.solved ? state.guessCount : null} />
            <CommunityPanel community={game.community} modes={game.modes} />
          </aside>
        </div>
      )}

      {game && <Credits />}
    </AppShell>
  )
}
