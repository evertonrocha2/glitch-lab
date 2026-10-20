// A magnifying glass with an error squiggle inside the lens.
export default function Logo({ className = '' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="13.5" cy="13.5" r="9.5" fill="white" stroke="currentColor" strokeWidth="2.5" />
      <path d="M20.5 20.5 27.5 27.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M8 14.5q1.375-2.75 2.75 0t2.75 0 2.75 0 2.75 0"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
