import { CONCEPTS } from '../../../shared/concepts.js'

// What each bug type usually looks like when it hits you.
const EXAMPLES = {
  'undefined-access': "Cannot read properties of undefined (reading 'length')",
  'index-out-of-range': 'IndexError: list index out of range',
  'not-defined': 'ReferenceError: total is not defined',
  'type-mismatch': 'can only concatenate str (not "int") to str',
  'off-by-one': 'The loop runs one time too many',
  'indentation-syntax': 'IndentationError: expected an indented block',
  'missing-return': 'The function gives back undefined (or None)',
  'wrong-comparison': 'if (age = 18) is always true',
  'mutation-reference': 'Changed the copy, and the original changed too',
  'async-await': 'Promise { <pending> }',
  'key-error': "KeyError: 'email'",
  other: 'Anything else. Still explained, still saved.',
}

export default function BugTypes() {
  return (
    <section id="bugs" aria-labelledby="bugs-title" className="scroll-mt-4 border-b-2 border-ink bg-white">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="font-label text-[11px] text-secondary">The usual suspects</p>
            <h2 id="bugs-title" className="mt-4 font-pixel text-3xl font-bold leading-tight text-ink sm:text-[2.6rem]">
              {CONCEPTS.length} kinds of bugs, on file
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              The AI tags every case with one of these. That's how the gym knows what to train, and how your board spots
              the one you keep repeating.
            </p>
          </div>
        </div>
        <ul aria-label="Bug types" className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONCEPTS.map((concept, index) => (
            <li key={concept.id} className="flex items-stretch border-2 border-ink bg-white">
              <span
                aria-hidden="true"
                className={`grid w-12 shrink-0 place-items-center border-r-2 border-ink font-label text-xs ${index % 2 ? 'bg-secondary-soft text-secondary' : 'bg-primary-soft text-primary'}`}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 px-3 py-2.5">
                <span className="block font-semibold text-ink">{concept.label}</span>
                <span className="block truncate font-mono text-xs text-muted" title={EXAMPLES[concept.id]}>
                  {EXAMPLES[concept.id]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
