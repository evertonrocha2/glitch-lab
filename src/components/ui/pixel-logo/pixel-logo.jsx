// A pixel Erlenmeyer flask whose liquid glitches: one slice jumps left and leaves a blue ghost.
export default function PixelLogo({ className = '' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 13 13" shapeRendering="crispEdges" className={className}>
      <g className="fill-ink">
        <rect x="4" y="0" width="5" height="1" />
        <rect x="5" y="1" width="1" height="3" />
        <rect x="7" y="1" width="1" height="3" />
        <rect x="4" y="4" width="1" height="1" />
        <rect x="8" y="4" width="1" height="1" />
        <rect x="3" y="5" width="1" height="1" />
        <rect x="9" y="5" width="1" height="1" />
        <rect x="2" y="6" width="1" height="2" />
        <rect x="10" y="6" width="1" height="2" />
        <rect x="0" y="8" width="1" height="2" />
        <rect x="10" y="8" width="1" height="2" />
        <rect x="1" y="10" width="1" height="1" />
        <rect x="11" y="10" width="1" height="1" />
        <rect x="1" y="11" width="11" height="1" />
      </g>
      <g className="fill-primary">
        <rect x="6" y="2" width="1" height="1" />
        <rect x="7" y="5" width="1" height="1" />
        <rect x="3" y="7" width="7" height="1" />
        <rect x="1" y="8" width="9" height="2" />
        <rect x="2" y="10" width="9" height="1" />
      </g>
      <rect className="fill-secondary" x="11" y="8" width="2" height="2" />
    </svg>
  )
}
