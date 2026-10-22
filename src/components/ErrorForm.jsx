import { useMemo, useState } from 'react'
import { scanError } from '../../shared/errorScan.js'
import { LIMITS } from '../../shared/limits.js'
import { mentionedLines, mergeFiles, preparePayload, readFiles, suggestSelection } from '../lib/attachments.js'
import { EXAMPLES } from '../lib/examples.js'
import CodeEditor from './CodeEditor.jsx'
import Attachments from './investigate/Attachments.jsx'
import ScanStrip from './investigate/ScanStrip.jsx'
import PixelButton from './pixel/PixelButton.jsx'

const labelClass = 'font-label text-xs text-ink'
// Each box shows focus on its frame, so the textarea itself drops the outline.
const textareaClass = 'block w-full resize-none bg-transparent font-mono text-sm leading-relaxed focus-visible:outline-none'

export default function ErrorForm({ onSubmit, loading, initialError = '', initialCode = '', initialContext = '' }) {
  const [error, setError] = useState(initialError)
  const [code, setCode] = useState(initialCode)
  const [context, setContext] = useState(initialContext)
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [skipped, setSkipped] = useState(0)
  const [reading, setReading] = useState(false)

  const scan = useMemo(() => scanError(error), [error])
  const mentioned = useMemo(() => mentionedLines(files, scan.locations), [files, scan.locations])
  const canSubmit = error.trim() !== '' && !loading && !reading

  async function addFiles(list) {
    setReading(true)
    try {
      const read = await readFiles(list)
      const next = mergeFiles(files, read.files)
      setFiles(next)
      setSkipped((count) => count + read.skipped)
      setSelected(suggestSelection(next, mentionedLines(next, scan.locations)))
    } finally {
      setReading(false)
    }
  }

  function toggle(path) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else if (next.size < LIMITS.files) next.add(path)
      return next
    })
  }

  function remove(path) {
    setFiles((current) => current.filter((file) => file.path !== path))
    setSelected((current) => new Set([...current].filter((item) => item !== path)))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    const payload = preparePayload(files, selected, mentioned)
    // Code goes as-is: indentation can be the bug itself. Empty extras are left out.
    onSubmit({
      error: error.trim(),
      code,
      ...(context.trim() ? { context: context.trim() } : {}),
      ...(payload.length ? { files: payload } : {}),
    })
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
        {error.trim() && <ScanStrip scan={scan} mentioned={mentioned} />}
      </div>

      <div>
        <label htmlFor="context-input" className={labelClass}>
          What were you trying to do? (optional)
        </label>
        <input
          id="context-input"
          value={context}
          onChange={(event) => setContext(event.target.value)}
          maxLength={LIMITS.context}
          placeholder="Show the length of the user's name on the profile page"
          className="mt-2 w-full border-2 border-ink bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 transition-shadow duration-150 focus:shadow-pixel focus-visible:outline-none"
        />
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
      </div>

      <div>
        <p className={labelClass}>Your project files (optional)</p>
        <div className="mt-2">
          <Attachments
            files={files}
            selected={selected}
            mentioned={mentioned}
            skipped={skipped}
            reading={reading}
            onAdd={addFiles}
            onToggle={toggle}
            onRemove={remove}
            onClear={() => {
              setFiles([])
              setSelected(new Set())
              setSkipped(0)
            }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">Don't paste or upload passwords, API keys or .env files.</p>
      </div>

      <PixelButton type="submit" disabled={!canSubmit} className="px-5 py-3">
        {loading ? 'Investigating...' : 'Investigate'}
      </PixelButton>
    </form>
  )
}
