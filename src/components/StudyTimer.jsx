import { formatClock, formatDuration } from '../lib/day.js'
import { useT } from '../lib/i18n/I18nProvider.jsx'
import { useProgress } from '../lib/progress/ProgressProvider.jsx'
import { useStudyTimer } from '../lib/timer/StudyTimerProvider.jsx'
import PixelButton from './pixel/PixelButton.jsx'

// A small pixel stopwatch pinned to the corner of every signed-in page.
export default function StudyTimer() {
  const { running, seconds, unsentSeconds, start, pause, reset } = useStudyTimer()
  const { progress } = useProgress()
  const t = useT()
  const today = (progress?.todaySeconds ?? 0) + unsentSeconds

  return (
    <section
      aria-label={t('app.timer.label')}
      className="fixed bottom-4 left-4 z-30 flex items-center gap-3 border-2 border-ink bg-white py-1.5 pr-1.5 pl-3 shadow-pixel-secondary"
    >
      <span aria-hidden="true" className={`size-2.5 shrink-0 border border-ink ${running ? 'bg-primary motion-safe:animate-blink' : 'bg-white'}`} />
      <span className="flex flex-col">
        <span className="font-label text-[10px] leading-tight text-secondary">{running ? t('app.timer.studying') : seconds > 0 ? t('app.timer.paused') : t('app.timer.label')}</span>
        <span className="font-pixel font-bold text-lg leading-tight text-ink tabular-nums" data-testid="timer-clock">
          {formatClock(seconds)}
        </span>
      </span>
      <span className="hidden border-l-2 border-dashed border-line pl-3 text-xs leading-tight text-muted sm:block">
        {t('app.timer.today')}
        <br />
        <strong className="text-ink">{formatDuration(today)}</strong>
      </span>
      <span className="flex gap-1.5">
        {running ? (
          <PixelButton variant="secondary" onClick={pause} className="px-2.5 py-2" aria-label={t('app.timer.pauseLabel')}>
            {t('app.timer.pause')}
          </PixelButton>
        ) : (
          <PixelButton onClick={start} className="px-2.5 py-2" aria-label={t('app.timer.startLabel')}>
            {seconds > 0 ? t('app.timer.resume') : t('app.timer.start')}
          </PixelButton>
        )}
        {!running && seconds > 0 && (
          <PixelButton variant="ghost" onClick={reset} className="px-2 py-2" aria-label={t('app.timer.resetLabel')}>
            {t('app.timer.reset')}
          </PixelButton>
        )}
      </span>
    </section>
  )
}
