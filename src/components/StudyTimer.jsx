import { formatClock, formatDuration } from '../lib/day.js'
import { useProgress } from '../lib/progress/ProgressProvider.jsx'
import { useStudyTimer } from '../lib/timer/StudyTimerProvider.jsx'
import PixelButton from './pixel/PixelButton.jsx'

// A small pixel stopwatch pinned to the corner of every signed-in page.
export default function StudyTimer() {
  const { running, seconds, unsentSeconds, start, pause, reset } = useStudyTimer()
  const { progress } = useProgress()
  const today = (progress?.todaySeconds ?? 0) + unsentSeconds

  return (
    <section
      aria-label="Study timer"
      className="fixed bottom-4 left-4 z-30 w-[calc(100vw-2rem)] max-w-64 border-2 border-ink bg-white shadow-pixel-secondary"
    >
      <div className="flex items-center justify-between border-b-2 border-ink bg-secondary-soft px-3 py-1.5">
        <p className="flex items-center gap-1.5 font-label text-[10px] text-secondary">
          <span aria-hidden="true" className={`size-2 border border-ink ${running ? 'bg-primary motion-safe:animate-blink' : 'bg-white'}`} />
          {running ? 'Studying' : seconds > 0 ? 'Paused' : 'Study timer'}
        </p>
        <p className="text-xs text-muted">Today {formatDuration(today)}</p>
      </div>
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <p className="font-label text-2xl leading-none text-ink tabular-nums" data-testid="timer-clock">
          {formatClock(seconds)}
        </p>
        <div className="flex gap-2">
          {running ? (
            <PixelButton variant="secondary" onClick={pause} className="px-3 py-2" aria-label="Pause the study timer">
              Pause
            </PixelButton>
          ) : (
            <PixelButton onClick={start} className="px-3 py-2" aria-label="Start the study timer">
              {seconds > 0 ? 'Resume' : 'Start'}
            </PixelButton>
          )}
          {!running && seconds > 0 && (
            <PixelButton variant="ghost" onClick={reset} className="px-2.5 py-2" aria-label="Reset the study timer">
              Reset
            </PixelButton>
          )}
        </div>
      </div>
    </section>
  )
}
