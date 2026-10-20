import { useId } from 'react'

// One wave every 7 units across a 121-wide box.
const WAVE = `M1 5${Array.from({ length: 17 }, (_, i) => (i === 0 ? ' Q4.5 0.5 8 5' : ` T${8 + i * 7} 5`)).join('')}`

// The wavy underline editors draw under errors. Across the app it marks "the why".
export default function Squiggle({ className = '', animated = false, delay = 0 }) {
  const gradientId = `squiggle-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  return (
    <svg aria-hidden="true" viewBox="0 0 121 10" preserveAspectRatio="none" fill="none" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" style={{ stopColor: 'var(--color-primary)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-secondary)' }} />
        </linearGradient>
      </defs>
      <path
        d={WAVE}
        pathLength="1"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.25"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        strokeDasharray={animated ? '1' : undefined}
        className={animated ? 'animate-draw motion-reduce:animate-none' : undefined}
        style={animated ? { animationDelay: `${delay}ms` } : undefined}
      />
    </svg>
  )
}
