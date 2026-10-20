import { useState } from 'react'
import { LIMITS } from '../../shared/limits.js'
import PixelButton from './pixel/PixelButton.jsx'

const fieldClass =
  'mt-2 w-full border-2 border-ink bg-white px-4 py-3 font-mono text-sm leading-relaxed text-ink placeholder:text-muted/60 transition-shadow duration-150 focus:shadow-pixel focus-visible:outline-none'

const labelClass = 'font-label text-[11px] text-ink'

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
        <label htmlFor="error-input" className={labelClass}>
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
        <label htmlFor="code-input" className={labelClass}>
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

      <PixelButton type="submit" disabled={!canSubmit} className="px-5 py-3">
        {loading ? 'Investigating...' : 'Investigate'}
      </PixelButton>
    </form>
  )
}
