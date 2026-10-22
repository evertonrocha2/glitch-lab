const chip = 'border-2 px-1.5 py-0.5 font-mono text-[11px] leading-none'
const baseName = (path) => path.split('/').pop()

// What we can already tell from the error, before any AI: type, language, and where it points.
export default function ScanStrip({ scan, mentioned }) {
  const matchedNames = new Set([...mentioned.keys()].map(baseName))
  return (
    <div aria-live="polite" className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 font-label text-[10px] text-muted">Scan</span>
      {scan.type ? (
        <>
          <span className={`${chip} border-ink bg-white text-ink`}>{scan.type}</span>
          {scan.language && <span className={`${chip} border-line bg-white text-muted`}>{scan.language}</span>}
          {scan.locations.slice(0, 4).map((spot) => {
            const matched = matchedNames.has(baseName(spot.file))
            return (
              <span
                key={`${spot.file}:${spot.line}`}
                title={spot.file}
                className={`${chip} ${matched ? 'border-ink bg-primary text-white' : 'border-secondary/40 bg-secondary-soft text-secondary'}`}
              >
                {baseName(spot.file)}:{spot.line}
                {matched && <span className="sr-only"> (attached)</span>}
              </span>
            )
          })}
          {scan.locations.length === 0 && <span className="text-xs text-muted">No file or line in the message. A full stack trace helps.</span>}
        </>
      ) : (
        <span className="text-xs text-muted">No error type found yet. Paste the whole message.</span>
      )}
    </div>
  )
}
