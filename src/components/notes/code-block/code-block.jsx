import { useEffect, useRef, useState } from 'react'
import { NOTE_LIMITS } from '../../../../shared/limits.js'
import { CODE_LANGUAGES } from '../../../../shared/note-blocks.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import CodeEditor from '../../ui/code-editor/code-editor.jsx'

// A code block in a note: the gym's code editor (Tab indents, Enter keeps the indent, Ctrl+/
// comments in the block's language), a language picker and a copy button.
// fieldRef gets the textarea, so the note editor can move focus into it.
export default function CodeBlock({ block, onChange, fieldRef }) {
  const t = useT()
  const wrapper = useRef(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fieldRef(wrapper.current?.querySelector('textarea') ?? null)
    return () => fieldRef(null)
  }, [fieldRef])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(block.text)
      setCopied(true)
    } catch {
      // No clipboard (an old browser or no permission): the code is still there to select by hand.
    }
  }

  return (
    <div ref={wrapper}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-2 border-b-0 border-ink bg-mist px-1">
        <select
          aria-label={t('notes.code.language')}
          value={block.language}
          onChange={(event) => onChange({ language: event.target.value })}
          className="min-h-10 cursor-pointer bg-transparent px-2 font-label text-[10px] text-ink focus-visible:outline-2"
        >
          <option value="">{t('notes.code.plain')}</option>
          {CODE_LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </select>
        <button type="button" onClick={copy} aria-label={t('notes.code.copyLabel')} className="min-h-10 px-3 font-label text-[10px] text-ink hover:text-primary">
          <span aria-live="polite">{copied ? t('notes.code.copied') : t('notes.code.copy')}</span>
        </button>
      </div>
      <CodeEditor
        id={`note-code-${block.id}`}
        value={block.text}
        onChange={(text) => onChange({ text })}
        language={block.language}
        minLines={3}
        maxLength={NOTE_LIMITS.code}
        showShortcuts={false}
        label={t('notes.block.code')}
      />
    </div>
  )
}
