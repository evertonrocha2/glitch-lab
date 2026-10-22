import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { gameNumber } from '../../shared/riddle/game.js'
import AppShell from '../components/AppShell.jsx'
import Leaderboard from '../components/daily/Leaderboard.jsx'
import PuzzleCard, { PuzzleStatus, PuzzleTags, StartButton, xpFor } from '../components/daily/PuzzleCard.jsx'
import ErrorNotice from '../components/ErrorNotice.jsx'
import { AuthError, getDaily, getGlobalChallenge, startPuzzle } from '../lib/api.js'
import { useAuth } from '../lib/auth/AuthProvider.jsx'
import { formatCountdown } from '../lib/daily.js'

// Ticks once a second for the countdowns.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

const weekLabel = (monday) => new Date(`${monday}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function GlobalChallenge({ data, now, onStart, starting }) {
  const { puzzle, solvedCount, leaderboard, you } = data
  return (
    <section aria-labelledby="global-title" className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-label text-xs text-secondary">Week of {weekLabel(data.week)}</p>
          <h2 id="global-title" className="mt-1 font-pixel text-2xl font-bold text-ink sm:text-3xl">
            Global challenge
          </h2>
        </div>
        <p className="font-label text-xs text-muted">Ends in {formatCountdown(Date.parse(data.endsAt) - now)}</p>
      </div>
      <p className="mt-2 max-w-2xl text-muted">One harder puzzle a week for every detective, with more than one bug inside. The clock runs from the moment you start.</p>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="relative overflow-hidden border-2 border-ink bg-white shadow-pixel-secondary">
          <span aria-hidden="true" className="dither-secondary absolute inset-y-0 right-0 w-1/2 opacity-25" />
          <div className="relative flex items-center justify-between gap-3 border-b-2 border-ink bg-secondary px-5 py-2 font-label text-xs text-white">
            <span>Weekly · hard</span>
            <span>+{xpFor(puzzle)} XP</span>
          </div>
          <div className="relative p-5 sm:p-6">
            <h3 className="font-pixel text-2xl font-bold leading-tight text-ink sm:text-3xl">{puzzle.title}</h3>
            <div className="mt-3">
              <PuzzleTags puzzle={puzzle} />
            </div>
            <p className="mt-4 border-2 border-ink bg-mist px-3 py-2 font-mono text-xs leading-relaxed text-ink wrap-break-word">
              <span aria-hidden="true" className="font-bold text-secondary">
                &gt;{' '}
              </span>
              {puzzle.symptom}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="font-label text-xs text-ink">
                  {solvedCount} {solvedCount === 1 ? 'detective' : 'detectives'} solved it
                </p>
                <PuzzleStatus puzzle={puzzle} />
              </div>
              <StartButton puzzle={puzzle} onStart={onStart} busy={starting !== null} variant="secondary" className="px-5 py-3" />
            </div>
          </div>
        </div>
        <Leaderboard entries={leaderboard} you={you} />
      </div>
    </section>
  )
}

// A 3x3 board of graded cells, the way a Glitchdle guess looks.
const TEASER_CELLS = ['bg-primary', 'bg-white', 'bg-secondary', 'bg-white', 'bg-primary', 'bg-white', 'bg-secondary', 'bg-primary', 'bg-primary']

function GlitchdleTeaser({ day }) {
  return (
    <Link
      to="/glitchdle"
      className="group mt-10 flex items-center gap-4 border-2 border-ink bg-white p-4 shadow-pixel transition-transform hover:-translate-y-0.5 sm:max-w-xl sm:gap-5 sm:p-5"
    >
      <span aria-hidden="true" className="grid size-14 shrink-0 grid-cols-3 gap-[2px] border-2 border-ink bg-ink">
        {TEASER_CELLS.map((color, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed decoration
          <span key={index} className={color} />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-label text-[10px] text-secondary">Also today</span>
        <span className="mt-0.5 block font-pixel text-xl font-bold text-ink group-hover:text-primary">Glitchdle #{gameNumber(day)}</span>
        <span className="mt-0.5 block text-sm text-muted">Guess the programming language of the day from its traits, an error and a hidden snippet.</span>
      </span>
      <span aria-hidden="true" className="hidden font-label text-xs text-primary sm:block">
        Play &gt;
      </span>
    </Link>
  )
}

// Three puzzles a day (the same for everyone) and one global challenge a week, with a leaderboard.
export default function DailyPage() {
  const { getToken, signOut } = useAuth()
  const navigate = useNavigate()
  const [daily, setDaily] = useState(null)
  const [global, setGlobal] = useState(null)
  const [message, setMessage] = useState('')
  const [starting, setStarting] = useState(null)
  // Blocks a second start before the disabled buttons re-render.
  const busy = useRef(false)
  const now = useNow()

  // An expired session signs out; the route guard brings the person back here after login.
  const handleError = useCallback(
    async (err) => {
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
    },
    [signOut],
  )

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      const [today, week] = await Promise.all([getDaily(token), getGlobalChallenge(token)])
      setDaily(today)
      setGlobal(week)
    } catch (err) {
      await handleError(err)
    }
  }, [getToken, handleError])

  useEffect(() => {
    load()
  }, [load])

  // When the countdown runs out, fetch the new set (once per set).
  const reloadedFor = useRef(null)
  useEffect(() => {
    if (!daily || Date.parse(daily.nextResetAt) > now || reloadedFor.current === daily.nextResetAt) return
    reloadedFor.current = daily.nextResetAt
    load()
  }, [daily, now, load])

  async function start(puzzle) {
    if (busy.current) return
    busy.current = true
    setStarting(puzzle.id)
    setMessage('')
    try {
      const challenge = await startPuzzle(puzzle.id, await getToken())
      navigate(`/gym/${challenge.id}`)
    } catch (err) {
      await handleError(err)
    } finally {
      busy.current = false
      setStarting(null)
    }
  }

  const solvedToday = daily?.puzzles.filter((item) => item.status === 'passed').length ?? 0

  return (
    <AppShell>
      <p className="font-label text-xs text-secondary">
        &gt; daily cases<span className="motion-safe:animate-caret">_</span>
      </p>
      <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">Daily challenges</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Three fresh bugs every day, the same for every detective. A new set lands at midnight, Brasilia time.
      </p>

      {message && (
        <div className="mt-6">
          <ErrorNotice message={message} />
        </div>
      )}

      {!daily && !message && (
        <p role="status" className="mt-10 font-label text-xs text-muted">
          Loading today's challenges...
        </p>
      )}

      {daily && (
        <>
          <ul aria-label="Daily summary" className="mt-8 grid grid-cols-3 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink sm:max-w-xl">
            {[
              { label: 'Streak', value: `${daily.streak}d`, tone: 'text-primary', note: 'days in a row' },
              { label: 'Today', value: `${solvedToday}/${daily.puzzles.length}`, tone: 'text-secondary', note: 'solved' },
              { label: 'Next set', value: formatCountdown(Date.parse(daily.nextResetAt) - now), tone: 'text-ink', note: 'to go' },
            ].map((item) => (
              <li key={item.label} className="min-w-0 bg-white px-3 py-3 sm:px-4">
                <span className="font-label text-[10px] text-muted sm:text-xs">{item.label}</span>
                <strong className={`mt-1 block pt-1 font-label text-lg leading-none tabular-nums sm:text-2xl ${item.tone}`}>{item.value}</strong>
                <span className="text-xs text-muted">{item.note}</span>
              </li>
            ))}
          </ul>

          <ul aria-label="Today's challenges" className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-3">
            {daily.puzzles.map((puzzle) => (
              <li key={puzzle.id}>
                <PuzzleCard puzzle={puzzle} onStart={start} busy={starting !== null} />
              </li>
            ))}
          </ul>

          <GlitchdleTeaser day={daily.day} />
        </>
      )}

      {global && <GlobalChallenge data={global} now={now} onStart={start} starting={starting} />}
    </AppShell>
  )
}
