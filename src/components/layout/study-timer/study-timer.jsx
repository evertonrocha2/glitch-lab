import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { formatClock, formatDuration } from '../../../lib/day.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useProgressData } from '../../../lib/progress/progress-provider.jsx'
import { useStudyClock, useStudyFocus, useStudyTimer } from '../../../lib/timer/study-timer-provider.jsx'
import TopicForm from '../../study/topic-form/topic-form.jsx'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'

// Three lines of a log, in the pixel style of the other icons.
const LOG_ROWS = ['#.#####', '.......', '#.#####', '.......', '#.####.', '.......', '.......']

function LogIcon() {
  return (
    <svg viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" className="size-3.5 fill-current">
      {/* biome-ignore lint/suspicious/noArrayIndexKey: fixed pixels, keyed by their place */}
      {LOG_ROWS.flatMap((row, y) => [...row].map((cell, x) => (cell === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)))}
    </svg>
  )
}

// The only part that ticks: the label, the clock face and today's total.
function ClockFace({ running, paused }) {
  const { seconds, unsentSeconds } = useStudyClock()
  const progress = useProgressData()
  const t = useT()
  const today = (progress?.todaySeconds ?? 0) + unsentSeconds
  return (
    <>
      <span aria-hidden="true" className={`size-2.5 shrink-0 border border-ink ${running ? 'bg-primary motion-safe:animate-blink' : 'bg-white'}`} />
      <span className="flex flex-col">
        <span className="font-label text-[10px] leading-tight text-secondary">{running ? t('app.timer.studying') : paused ? t('app.timer.paused') : t('app.timer.label')}</span>
        <span className="font-pixel font-bold text-lg leading-tight text-ink tabular-nums" data-testid="timer-clock">
          {formatClock(seconds)}
        </span>
      </span>
      <span className="hidden border-l-2 border-dashed border-line pl-3 text-xs leading-tight text-muted sm:block">
        {t('app.timer.today')}
        <br />
        <strong className="text-ink">{formatDuration(today)}</strong>
      </span>
    </>
  )
}

// What this run is about, under the clock. w-0 min-w-full: a long topic is cut, never widening the widget.
function TopicLine({ onEdit }) {
  const { topic, caseId, noteId } = useStudyFocus()
  const t = useT()
  return (
    <div className="flex w-0 min-w-full items-center gap-2 border-t-2 border-dashed border-line pr-1.5 pl-3">
      <span className="min-w-0 flex-1 truncate text-xs" title={topic || undefined} data-testid="timer-topic">
        {topic ? <span className="text-ink">{topic}</span> : <span className="text-muted">{t('study.timer.noTopic')}</span>}
      </span>
      {(caseId || noteId) && (
        <span className="shrink-0 border border-ink bg-secondary-soft px-1 font-label text-[10px] text-secondary">{t(caseId ? 'study.link.case' : 'study.link.note')}</span>
      )}
      <button type="button" onClick={onEdit} aria-label={t('study.timer.editLabel')} className="min-h-10 shrink-0 px-1.5 font-label text-[10px] text-secondary hover:text-primary">
        {topic ? t('study.timer.edit') : t('study.timer.addTopic')}
      </button>
    </div>
  )
}

// A small pixel stopwatch pinned to the corner of every signed-in page. Start asks what you're
// studying (optional); the topic shows under the clock while it runs and can be changed there.
export default function StudyTimer() {
  const { running, paused, start, pause, reset, setFocus } = useStudyTimer()
  const focus = useStudyFocus()
  const t = useT()
  // 'start': the "what are you studying?" form before a fresh start. 'edit': changing it.
  const [form, setForm] = useState(null)

  // Started from somewhere else (another tab, the assistant): the start form has nothing left to do.
  useEffect(() => {
    if (running) setForm((open) => (open === 'start' ? null : open))
  }, [running])

  const close = () => setForm(null)

  return (
    <section aria-label={t('app.timer.label')} className="fixed bottom-4 left-4 z-30 w-max max-w-[calc(100vw-2rem)] border-2 border-ink bg-white shadow-pixel-secondary">
      {form && (
        <div className="w-[min(20rem,calc(100vw-2rem-4px))] border-b-2 border-dashed border-line p-3">
          <TopicForm
            key={form}
            initial={form === 'edit' ? focus : null}
            submitLabel={form === 'edit' ? t('study.save') : t('app.timer.start')}
            onSubmit={async (next) => {
              close()
              if (form === 'edit') await setFocus(next)
              else await start(next)
            }}
            onCancel={close}
          />
        </div>
      )}
      <div className="flex items-center gap-3 py-1.5 pr-1.5 pl-3">
        <ClockFace running={running} paused={paused} />
        <span className="flex gap-1.5">
          {running ? (
            <PixelButton variant="secondary" onClick={pause} className="px-2.5 py-2" aria-label={t('app.timer.pauseLabel')}>
              {t('app.timer.pause')}
            </PixelButton>
          ) : paused ? (
            <PixelButton onClick={() => start()} className="px-2.5 py-2" aria-label={t('app.timer.startLabel')}>
              {t('app.timer.resume')}
            </PixelButton>
          ) : form === 'start' ? null : (
            // While the "what are you studying?" form is open, its own Start is the only one.
            <PixelButton
              onClick={() => setForm('start')}
              aria-expanded={form === 'start'}
              className="px-2.5 py-2"
              aria-label={t('app.timer.startLabel')}
            >
              {t('app.timer.start')}
            </PixelButton>
          )}
          {paused && (
            <PixelButton variant="ghost" onClick={reset} className="px-2 py-2" aria-label={t('app.timer.resetLabel')}>
              {t('app.timer.reset')}
            </PixelButton>
          )}
          <PixelButton as={Link} to="/study" variant="ghost" className="min-w-10 px-2 py-2" aria-label={t('study.timer.openLog')} title={t('study.timer.openLog')}>
            <LogIcon />
          </PixelButton>
        </span>
      </div>
      {(running || paused) && form !== 'edit' && <TopicLine onEdit={() => setForm('edit')} />}
    </section>
  )
}
