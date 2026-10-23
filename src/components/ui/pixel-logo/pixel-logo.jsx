// A pixel magnifying glass with a little bug in the lens.
export default function PixelLogo({ className = '' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 13 13" shapeRendering="crispEdges" className={className}>
      <g className="fill-ink">
        <rect x="3" y="0" width="4" height="1" />
        <rect x="2" y="1" width="1" height="1" />
        <rect x="7" y="1" width="1" height="1" />
        <rect x="1" y="2" width="1" height="4" />
        <rect x="8" y="2" width="1" height="4" />
        <rect x="2" y="6" width="1" height="1" />
        <rect x="7" y="6" width="1" height="1" />
        <rect x="3" y="7" width="4" height="1" />
        <rect x="8" y="8" width="2" height="2" />
        <rect x="10" y="10" width="2" height="2" />
      </g>
      <g className="fill-primary">
        <rect x="3" y="3" width="1" height="1" />
        <rect x="5" y="3" width="1" height="1" />
        <rect x="4" y="4" width="1" height="1" />
        <rect x="6" y="4" width="1" height="1" />
      </g>
    </svg>
  )
}
