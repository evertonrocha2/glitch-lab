import { LOGO_ROWS, LOGO_ROWS_DETAILED, logoRuns } from './logo-pixels.js'

const RUNS = logoRuns(LOGO_ROWS)
const DETAILED_RUNS = logoRuns(LOGO_ROWS_DETAILED)

// The mark, "Grimório" (logo-pixels.js). `detailed` is the cut for large sizes (about 48px and up).
export default function PixelLogo({ className = '', detailed = false }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" shapeRendering="crispEdges" className={className}>
      {(detailed ? DETAILED_RUNS : RUNS).map(({ x, y, width, fill }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={width} height="1" fill={fill} />
      ))}
    </svg>
  )
}

// "Study" in the text color, "Quest" in gold: the wordmark next to the mark.
export function Wordmark({ className = '' }) {
  return (
    <span className={className}>
      Study<span className="text-gold">Quest</span>
    </span>
  )
}
