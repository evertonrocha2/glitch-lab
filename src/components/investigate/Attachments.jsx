import { useEffect, useRef, useState } from 'react'
import { languageOfPath } from '../../../shared/errorScan.js'
import { LIMITS } from '../../../shared/limits.js'
import PixelButton from '../pixel/PixelButton.jsx'

// Drop zone, file and folder pickers, and the list of what's attached with a tick for what gets sent.
export default function Attachments({ files, selected, mentioned, skipped, reading, onAdd, onToggle, onRemove, onClear }) {
  const fileInput = useRef(null)
  const folderInput = useRef(null)
  const [dragging, setDragging] = useState(false)

  // React has no prop for folder picking; the attribute still works in every current browser.
  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '')
  }, [])

  const pick = (event) => {
    if (event.target.files?.length) onAdd(event.target.files)
    event.target.value = ''
  }

  const full = selected.size >= LIMITS.files
  // The files the error points at come first.
  const ordered = [...files].sort((a, b) => Number(mentioned.has(b.path)) - Number(mentioned.has(a.path)))

  return (
    <div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dropping is an extra; both buttons do the same */}
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (event.dataTransfer.files.length) onAdd(event.dataTransfer.files)
        }}
        className={`flex flex-wrap items-center gap-3 border-2 border-dashed px-4 py-4 transition-colors ${dragging ? 'border-primary bg-primary-soft' : 'border-ink/40 bg-mist'}`}
      >
        <PixelButton variant="ghost" onClick={() => fileInput.current?.click()} disabled={reading} className="px-3 py-2">
          Upload files
        </PixelButton>
        <PixelButton variant="ghost" onClick={() => folderInput.current?.click()} disabled={reading} className="px-3 py-2">
          Upload a folder
        </PixelButton>
        <p className="min-w-48 flex-1 text-xs text-muted">
          {reading ? 'Reading your files...' : 'or drop files here. We find the ones the error mentions and send only the lines around it.'}
        </p>
        <input ref={fileInput} type="file" multiple onChange={pick} className="hidden" aria-label="Upload files" />
        <input ref={folderInput} type="file" multiple onChange={pick} className="hidden" aria-label="Upload a folder" />
      </div>

      {files.length > 0 && (
        <div className="mt-3 border-2 border-ink bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink bg-mist px-3 py-2">
            <p className="text-xs text-ink">
              <strong>
                {selected.size}/{LIMITS.files}
              </strong>{' '}
              of {files.length} {files.length === 1 ? 'file' : 'files'} will be sent
              {skipped > 0 && <span className="text-muted"> · {skipped} skipped (not code, too big, or in node_modules)</span>}
            </p>
            <button type="button" onClick={onClear} className="font-label text-[10px] text-muted underline underline-offset-2 hover:text-ink">
              Remove all
            </button>
          </div>
          <ul aria-label="Attached files" className="max-h-56 divide-y-2 divide-dashed divide-line overflow-y-auto">
            {ordered.map((file) => {
              const line = mentioned.get(file.path)
              const checked = selected.has(file.path)
              return (
                <li key={file.path} className="flex items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && full}
                    onChange={() => onToggle(file.path)}
                    aria-label={`Send ${file.path}`}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink" title={file.path}>
                    {file.path}
                  </span>
                  {line && <span className="shrink-0 bg-primary px-1.5 py-0.5 font-label text-[9px] text-white">error · line {line}</span>}
                  <span className="hidden shrink-0 text-[11px] text-muted sm:inline">{languageOfPath(file.path)}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(file.path)}
                    aria-label={`Remove ${file.path}`}
                    className="shrink-0 px-1 text-lg leading-none text-muted hover:text-ink"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
