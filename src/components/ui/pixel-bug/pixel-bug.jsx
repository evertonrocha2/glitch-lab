import { BUG } from '../../../../shared/bug.js'

const WIDTH = BUG[0].length
const HEIGHT = BUG.length

// Antennae and head in blue, body in purple, with a hard ink shadow like the buttons.
export default function PixelBug({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      shapeRendering="crispEdges"
      className={`drop-shadow-[3px_3px_0_var(--color-ink)] ${className}`}
    >
      {BUG.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === 'x' ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              className={y < 3 ? 'fill-secondary' : 'fill-primary'}
            />
          ) : null,
        ),
      )}
    </svg>
  )
}
