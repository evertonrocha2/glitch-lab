import { useT } from '../../../lib/i18n/I18nProvider.jsx'

// A pixel arrow pointing up; the other three are the same arrow turned.
const TURN = { up: 0, right: 90, down: 180, left: 270 }

function Arrow({ dir }) {
  return (
    <svg viewBox="0 0 5 5" shapeRendering="crispEdges" aria-hidden="true" className="size-4 fill-ink" style={{ transform: `rotate(${TURN[dir]}deg)` }}>
      <rect x="2" y="0" width="1" height="1" />
      <rect x="1" y="1" width="3" height="1" />
      <rect x="0" y="2" width="5" height="1" />
      <rect x="2" y="3" width="1" height="2" />
    </svg>
  )
}

const PLACE = { up: 'col-start-2 row-start-1', left: 'col-start-1 row-start-2', right: 'col-start-3 row-start-2', down: 'col-start-2 row-start-3' }

// The on-screen pad for phones: hold a button to keep walking (onPress, then onRelease). A button
// pressed from the keyboard (a click with no pointer) takes one step (onStep).
export default function DPad({ onPress, onRelease, onStep, className = '' }) {
  const t = useT()
  return (
    <div role="group" aria-label={t('world.dpad.label')} className={`grid w-fit grid-cols-3 grid-rows-3 gap-1 ${className}`}>
      {Object.keys(PLACE).map((dir) => (
        <button
          key={dir}
          type="button"
          aria-label={t(`world.dpad.${dir}`)}
          className={`grid size-12 touch-none place-items-center border-2 border-ink bg-white shadow-pixel-ink select-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--color-ink)] ${PLACE[dir]}`}
          onPointerDown={(event) => {
            event.preventDefault()
            onPress(dir)
          }}
          onPointerUp={() => onRelease()}
          onPointerLeave={() => onRelease()}
          onPointerCancel={() => onRelease()}
          onContextMenu={(event) => event.preventDefault()}
          onClick={(event) => {
            if (event.detail === 0) onStep(dir)
          }}
        >
          <Arrow dir={dir} />
        </button>
      ))}
    </div>
  )
}
