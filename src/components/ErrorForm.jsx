import { useState } from 'react'
import { LIMITS } from '../../shared/limits.js'

const fieldClass =
  'mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:outline-none'

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
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div>
        <label htmlFor="error-input" className="text-sm font-medium text-zinc-300">
          Error message
        </label>
        <textarea
          id="error-input"
          value={error}
          onChange={(event) => setError(event.target.value)}
          maxLength={LIMITS.error}
          rows={3}
          placeholder="TypeError: Cannot read properties of undefined (reading 'length')"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="code-input" className="text-sm font-medium text-zinc-300">
          Code (optional)
        </label>
        <textarea
          id="code-input"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={LIMITS.code}
          rows={8}
          spellCheck={false}
          className={`${fieldClass} font-mono text-sm`}
        />
        <p className="mt-1 text-xs text-zinc-500">Don't paste passwords or API keys.</p>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-lg bg-amber-400 px-5 py-2.5 font-semibold text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Investigating...' : 'Investigate'}
      </button>
    </form>
  )
}
