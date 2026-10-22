import { useState } from 'react'
import { LIMITS } from '../../shared/limits.js'
import { EXAMPLES } from '../lib/examples.js'
import CodeEditor from './CodeEditor.jsx'
import PixelButton from './pixel/PixelButton.jsx'

const labelClass = 'font-label text-xs text-ink'
// Each box shows focus on its frame, so the textarea itself drops the outline.
const textareaClass = 'block w-full resize-none bg-transparent font-mono text-sm leading-relaxed focus-visible:outline-none'

export default function ErrorForm({ onSubmit, loading, initialError = '', initialCode = '' }) {
  const [error, setError] = useState(initialError)
  const [code, setCode] = useState(initialCode)

  const canSubmit = error.trim() !== '' && !loading

  function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    // Code goes as-is: indentation can be the bug itself.
    onSubmit({ error: error.trim(), code })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted">Try an example:</span>
        {EXAMPLES.map((example) => (
          <PixelButton
            key={example.label}
            variant="ghost"
            onClick={() => {
              setError(example.error)
              setCode(example.code)
            }}
            className="px-2.5 py-1.5 text-[10px]"
          >
            {example.label}
          </PixelButton>
        ))}
      </div>

      <div>
        <label htmlFor="error-input" className={labelClass}>
          Error message
        </label>
        <div className="mt-2 border-2 border-ink bg-primary-soft transition-shadow duration-150 focus-within:shadow-pixel">
          <p aria-hidden="true" className="flex items-center gap-2 border-b-2 border-ink bg-primary px-3 py-1.5 font-label text-[10px] text-white">
            <span className="flex gap-1">
              <span className="size-1.5 bg-white" />
              <span className="size-1.5 bg-white/60" />
              <span className="size-1.5 bg-white/30" />
            </span>
            console
          </p>
          <div className="flex gap-2.5 px-3 py-3">
            <span aria-hidden="true" className="select-none font-mono text-sm font-bold leading-relaxed text-primary">
              &gt;
            </span>
            <textarea
              id="error-input"
              value={error}
              onChange={(event) => setError(event.target.value)}
              maxLength={LIMITS.error}
              rows={3}
              spellCheck={false}
              placeholder="TypeError: Cannot read properties of undefined (reading 'length')"
              className={`${textareaClass} text-ink placeholder:text-muted/70`}
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="code-input" className={labelClass}>
          Code (optional)
        </label>
        <div className="mt-2">
          <CodeEditor
            id="code-input"
            value={code}
            onChange={setCode}
            maxLength={LIMITS.code}
            placeholder="Paste the code around the error"
          />
        </div>
        <p className="mt-2 text-xs text-muted">Don't paste passwords or API keys.</p>
      </div>

      <PixelButton type="submit" disabled={!canSubmit} className="px-5 py-3">
        {loading ? 'Investigating...' : 'Investigate'}
      </PixelButton>
    </form>
  )
}
