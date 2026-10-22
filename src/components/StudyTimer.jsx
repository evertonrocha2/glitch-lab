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
      className="fixed bottom-4 left-4 z-30 flex items-center gap-3 border-2 border-ink bg-white py-1.5 pr-1.5 pl-3 shadow-pixel-secondary"
    >
      <span aria-hidden="true" className={`size-2.5 shrink-0 border border-ink ${running ? 'bg-primary motion-safe:animate-blink' : 'bg-white'}`} />
      <span className="flex flex-col">
        <span className="font-label text-[9px] leading-tight text-secondary">{running ? 'Studying' : seconds > 0 ? 'Paused' : 'Study timer'}</span>
        <span className="font-label text-lg leading-tight text-ink tabular-nums" data-testid="timer-clock">
          {formatClock(seconds)}
        </span>
      </span>
      <span className="hidden border-l-2 border-dashed border-line pl-3 text-xs leading-tight text-muted sm:block">
        Today
        <br />
        <strong className="text-ink">{formatDuration(today)}</strong>
      </span>
      <span className="flex gap-1.5">
        {running ? (
          <PixelButton variant="secondary" onClick={pause} className="px-2.5 py-2" aria-label="Pause the study timer">
            Pause
          </PixelButton>
        ) : (
          <PixelButton onClick={start} className="px-2.5 py-2" aria-label="Start the study timer">
            {seconds > 0 ? 'Resume' : 'Start'}
          </PixelButton>
        )}
        {!running && seconds > 0 && (
          <PixelButton variant="ghost" onClick={reset} className="px-2 py-2" aria-label="Reset the study timer">
            Reset
          </PixelButton>
        )}
      </span>
    </section>
  )
}
