const ITEMS = [
  '12 bug types tracked',
  '3 hints, never the answer',
  '2 passes to solve a case',
  'Notes with @mentions',
  'Study timer',
  '12 badges to earn',
  'Export to Notion',
  'JavaScript · Python · and more',
]

function Row({ hidden = false }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {ITEMS.map((item) => (
        <li key={item} className="flex items-center gap-6 pr-6 font-label text-xs whitespace-nowrap text-white">
          {item}
          <span aria-hidden="true" className="size-2 bg-white/70" />
        </li>
      ))}
    </ul>
  )
}

// A pixel ticker of what's inside. The second copy makes the loop seamless; reduced motion keeps it still.
export default function Marquee() {
  return (
    <section aria-label="What's inside" className="overflow-hidden border-b-2 border-ink bg-primary py-3">
      <div className="flex w-max motion-safe:animate-marquee">
        <Row />
        <Row hidden />
      </div>
    </section>
  )
}
