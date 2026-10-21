import CaseCard from './CaseCard.jsx'

// Gray = just investigated, blue = practicing, purple = understood for good.
const COLUMNS = [
  { status: 'new', title: 'New', shadow: 'shadow-pixel-muted', empty: 'Investigate an error to open a case.' },
  { status: 'training', title: 'Training', shadow: 'shadow-pixel-secondary', empty: 'Press Train this on a case.' },
  { status: 'solved', title: 'Solved', shadow: 'shadow-pixel', empty: 'Pass 2 challenges to solve a case.' },
]

export default function Board({ cases, onOpen }) {
  return (
    <div className="grid items-start gap-6 md:grid-cols-3">
      {COLUMNS.map((column) => {
        const items = cases.filter((item) => item.status === column.status)
        return (
          <section
            key={column.status}
            aria-labelledby={`column-${column.status}`}
            className={`border-2 border-ink bg-white p-3 ${column.shadow}`}
          >
            <header className="flex items-center justify-between border-b-2 border-dashed border-ink pb-2">
              <h2 id={`column-${column.status}`} className="font-label text-xs text-ink">
                {column.title}
              </h2>
              <span className="font-pixel text-2xl font-bold text-ink">{String(items.length).padStart(2, '0')}</span>
            </header>
            {items.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {items.map((item) => (
                  <li key={item.id}>
                    <CaseCard item={item} onOpen={onOpen} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">{column.empty}</p>
            )}
          </section>
        )
      })}
    </div>
  )
}
