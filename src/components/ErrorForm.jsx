import { useState } from 'react'
import { LIMITS } from '../../shared/limits.js'

const fieldClass =
  'mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 font-mono text-sm leading-relaxed text-ink placeholder:text-muted/60 transition-[border-color,box-shadow] duration-200 focus:border-primary focus:shadow-[0_0_0_4px_rgba(106,61,240,0.14)] focus-visible:outline-none'

function Spinner() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4 motion-safe:animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export default function ErrorForm({ onSubmit, loading }) {
  const [error, setError] = useState('')
  const [code, setCode] = useState('')

  const canSubmit = error.trim() !== '' && !loading

  function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    // Code goes as-is: indentation can be the bug itself.
    onSubmit({ error: error.trim(), code })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="error-input" className="text-sm font-semibold text-ink">
          Error message
        </label>
        <textarea
          id="error-input"
          value={error}
          onChange={(event) => setError(event.target.value)}
          maxLength={LIMITS.error}
          rows={3}
          spellCheck={false}
          placeholder="TypeError: Cannot read properties of undefined (reading 'length')"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="code-input" className="text-sm font-semibold text-ink">
          Code (optional)
        </label>
        <textarea
          id="code-input"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={LIMITS.code}
          rows={8}
          spellCheck={false}
          placeholder="Paste the code around the error"
          className={fieldClass}
        />
        <p className="mt-2 text-xs text-muted">Don't paste passwords or API keys.</p>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 font-semibold text-white transition-colors duration-200 hover:bg-primary-strong disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
      >
        {loading && <Spinner />}
        {loading ? 'Investigating...' : 'Investigate'}
      </button>
    </form>
  )
}
