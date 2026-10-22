import { Link } from 'react-router'
import { conceptLabel } from '../../../shared/concepts.js'
import { kindLabel } from '../../../shared/trails.js'
import BadgeIcon from '../pixel/BadgeIcon.jsx'
import PixelButton from '../pixel/PixelButton.jsx'
import PixelCard from '../pixel/PixelCard.jsx'
import KindIcon from './KindIcon.jsx'

const STATUS = {
  done: { label: 'Done', name: 'done', chip: 'bg-primary text-white', tone: 'primary' },
  next: { label: 'Next up', name: 'next up', chip: 'bg-secondary text-white', tone: 'secondary' },
  todo: { label: 'To do', name: 'to do', chip: 'border border-muted/60 text-muted', tone: 'muted' },
}

// A dashed pixel line: 8px of ink, 6px of gap.
const DASHED_DOWN = 'bg-[repeating-linear-gradient(to_bottom,var(--color-ink)_0_8px,transparent_8px_14px)]'
const DASHED_ACROSS = 'bg-[repeating-linear-gradient(to_right,var(--color-ink)_0_6px,transparent_6px_10px)]'

function Node({ number, status }) {
  if (status === 'done') {
    return (
      <span className="relative z-10 grid size-12 place-items-center border-2 border-ink bg-primary-soft shadow-pixel-ink">
        <BadgeIcon id="fixed-it" className="size-7" />
      </span>
    )
  }
  return (
    <span
      className={`relative z-10 grid size-12 place-items-center border-2 font-label text-base ${
        status === 'next' ? 'border-ink bg-secondary text-white shadow-pixel' : 'border-ink/50 bg-white text-muted'
      }`}
    >
      {number}
      {status === 'next' && <span aria-hidden="true" className="absolute -inset-1.75 border-2 border-dashed border-secondary motion-safe:animate-blink" />}
    </span>
  )
}

// The button (or link) that does the mission. Done missions need none, except reflect, which can be undone.
function MissionAction({ mission, actions, busy, timerRunning }) {
  const small = 'px-3 py-2'
  const waiting = busy === mission.id
  if (mission.kind === 'reflect') {
    const done = mission.status === 'done'
    return (
      <PixelButton variant={done ? 'ghost' : 'primary'} className={small} disabled={Boolean(busy)} onClick={() => actions.reflect(mission, !done)}>
        {done ? 'Undo' : 'Mark as done'}
      </PixelButton>
    )
  }
  if (mission.status === 'done') return null
  switch (mission.kind) {
    case 'train':
      return (
        <PixelButton variant="secondary" className={small} disabled={Boolean(busy)} onClick={() => actions.train(mission)}>
          {waiting ? 'Starting...' : 'Train this case'}
        </PixelButton>
      )
    case 'note':
      return (
        <PixelButton className={small} disabled={Boolean(busy)} onClick={() => actions.note(mission)}>
          {waiting ? 'Opening...' : 'Write the note'}
        </PixelButton>
      )
    case 'study':
      return (
        <PixelButton variant="secondary" className={small} disabled={timerRunning} onClick={actions.study}>
          {timerRunning ? 'Timer running' : 'Start the timer'}
        </PixelButton>
      )
    case 'investigate':
      return (
        <PixelButton as={Link} to="/board" variant="ghost" className={small}>
          Go to the board
        </PixelButton>
      )
    default:
      return null
  }
}

function MissionCard({ mission, side, ...props }) {
  const status = STATUS[mission.status] ?? STATUS.todo
  const accent = mission.status === 'next' ? 'secondary' : 'primary'
  return (
    <div className="relative min-w-0">
      {/* The stub joining the card to its node on the path. */}
      <span
        aria-hidden="true"
        className={`absolute top-7 -left-4 h-1 w-4 ${DASHED_ACROSS} md:w-6 ${side === 'left' ? 'md:left-auto md:-right-6' : 'md:-left-6'}`}
      />
      <PixelCard tone={status.tone} className={`p-4 sm:p-5 ${mission.status === 'done' ? 'bg-white/80' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          <span className={`flex items-center gap-2 font-label text-[10px] ${accent === 'secondary' ? 'text-secondary' : 'text-primary'}`}>
            <KindIcon kind={mission.kind} accent={accent} className="size-5" />
            {kindLabel(mission.kind)}
          </span>
          <span className="border-2 border-ink bg-primary-soft px-1.5 py-0.5 font-label text-[10px] text-primary">+{mission.xp} XP</span>
        </div>
        <h3 className={`mt-3 font-pixel text-xl leading-tight ${mission.status === 'done' ? 'text-muted' : 'text-ink'}`}>{mission.title}</h3>
        <p className="mt-1.5 text-sm text-muted">{mission.description}</p>
        {(mission.concept || mission.kind === 'study') && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {mission.concept && <span className="bg-mist px-1.5 py-0.5 font-label text-[10px] text-ink">{conceptLabel(mission.concept)}</span>}
            {mission.kind === 'study' && <StudyMeter studied={mission.studiedMinutes ?? 0} goal={mission.minutes} />}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-line pt-3">
          <span className={`px-1.5 py-0.5 font-label text-[10px] ${status.chip}`}>{status.label}</span>
          <MissionAction mission={mission} {...props} />
        </div>
      </PixelCard>
    </div>
  )
}

function StudyMeter({ studied, goal }) {
  const blocks = 10
  const filled = Math.round((studied / goal) * blocks)
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="flex gap-0.5 border-2 border-ink bg-white p-0.5">
        {Array.from({ length: blocks }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative segments
          <span key={index} className={`h-2 w-1.5 ${index < filled ? 'bg-secondary' : 'bg-mist'}`} />
        ))}
      </span>
      <span className="font-label text-[10px] text-secondary">
        {studied}/{goal} min
      </span>
    </span>
  )
}

// The missions as a path: numbered nodes on a dashed pixel line. Phones get one column with the
// line on the left; wider screens put the line in the middle and zig-zag the cards around it.
export default function TrailMap({ missions, ...props }) {
  return (
    <ol aria-label="Trail missions" className="relative mt-10 flex flex-col gap-8">
      <span aria-hidden="true" className={`absolute top-6 bottom-6 left-5.5 w-1 ${DASHED_DOWN} md:left-1/2 md:-translate-x-1/2`} />
      {missions.map((mission, index) => {
        const side = index % 2 === 0 ? 'left' : 'right'
        return (
          <li
            key={mission.id}
            aria-label={`Mission ${index + 1}: ${(STATUS[mission.status] ?? STATUS.todo).name}`}
            className="relative grid grid-cols-[48px_minmax(0,1fr)] items-start gap-4 md:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] md:gap-6"
          >
            <div className="col-start-1 row-start-1 pt-1 md:col-start-2">
              <Node number={index + 1} status={mission.status} />
            </div>
            <div className={`col-start-2 row-start-1 ${side === 'left' ? 'md:col-start-1' : 'md:col-start-3'}`}>
              <MissionCard mission={mission} side={side} {...props} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
