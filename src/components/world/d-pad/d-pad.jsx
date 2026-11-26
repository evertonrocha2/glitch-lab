import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import Frame from '../../game/ui/frame.jsx'

// A solid pixel triangle pointing up; the other three are the same triangle turned. 10 art pixels drawn
// at 30px keep every art pixel 3 screen pixels, so it reads as an arrow even on a small phone (a thin
// tip and stem used to round into a "+").
const TURN = { up: 0, right: 90, down: 180, left: 270 }
const ROWS = [
  { y: 3, x: 4, w: 2 },
  { y: 4, x: 3, w: 4 },
  { y: 5, x: 2, w: 6 },
  { y: 6, x: 1, w: 8 },
  { y: 7, x: 0, w: 10 },
]

function Arrow({ dir }) {
  return (
    <svg
      viewBox="0 0 10 10"
      width="30"
      height="30"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="fill-[#e9e4ff]"
      style={{ transform: `rotate(${TURN[dir]}deg)` }}
    >
      {ROWS.map((row) => (
        <rect key={row.y} x={row.x} y={row.y} width={row.w} height="1" />
      ))}
    </svg>
  )
}

const PLACE = { up: 'col-start-2 row-start-1', left: 'col-start-1 row-start-2', right: 'col-start-3 row-start-2', down: 'col-start-2 row-start-3' }

// The on-screen pad for phones, in the game kit's raised buttons: hold a button to keep walking
// (onPress, then onRelease). A button pressed from the keyboard (a click with no pointer) takes one
// step (onStep).
export default function DPad({ onPress, onRelease, onStep, className = '' }) {
  const t = useT()
  return (
    <div role="group" aria-label={t('world.dpad.label')} className={`grid w-fit grid-cols-3 grid-rows-3 gap-1 ${className}`}>
      {Object.keys(PLACE).map((dir) => (
        <Frame
          as="button"
          tone="raised"
          key={dir}
          type="button"
          aria-label={t(`world.dpad.${dir}`)}
          className={`grid size-12 cursor-pointer touch-none place-items-center select-none ${PLACE[dir]}`}
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
        </Frame>
      ))}
    </div>
  )
}
