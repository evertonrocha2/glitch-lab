import PixelLogo from '../pixel/PixelLogo.jsx'

// [x, y, width, height] pixels on an 11x9 grid.
const SHAPES = {
  // Three kanban columns holding cards.
  board: [
    [0, 0, 3, 1], [4, 0, 3, 1], [8, 0, 3, 1],
    [0, 2, 3, 2], [0, 5, 3, 2], [4, 2, 3, 2], [8, 2, 3, 2], [8, 5, 3, 2], [8, 8, 3, 1],
  ],
  // A dumbbell: the gym.
  gym: [
    [0, 2, 1, 5], [1, 1, 2, 7], [3, 4, 5, 1], [8, 1, 2, 7], [10, 2, 1, 5],
  ],
}

export default function StepIcon({ kind, className = '' }) {
  if (kind === 'investigate') return <PixelLogo className={className} />
  return (
    <svg aria-hidden="true" viewBox="0 0 11 9" shapeRendering="crispEdges" className={`fill-current ${className}`}>
      {SHAPES[kind].map(([x, y, width, height]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={width} height={height} />
      ))}
    </svg>
  )
}
