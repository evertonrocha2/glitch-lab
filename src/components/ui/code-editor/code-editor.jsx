// A textarea with a line-number gutter. It grows with the code, so the gutter always lines up.
export default function CodeEditor({ id, value, onChange, minLines = 8, maxLength, placeholder, readOnly = false }) {
  const lines = Math.max(minLines, value.split('\n').length)

  return (
    <div className="flex border-2 border-ink bg-white transition-shadow duration-150 focus-within:shadow-pixel">
      <div
        aria-hidden="true"
        className="select-none border-r-2 border-ink bg-mist px-2.5 py-3 text-right font-mono text-sm leading-relaxed text-muted"
      >
        {Array.from({ length: lines }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: line numbers are positions.
          <div key={index}>{index + 1}</div>
        ))}
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        rows={lines}
        wrap="off"
        spellCheck={false}
        readOnly={readOnly}
        placeholder={placeholder}
        className="block w-full resize-none overflow-x-auto overflow-y-hidden bg-transparent px-3 py-3 font-mono text-sm leading-relaxed text-ink placeholder:text-muted/60 focus-visible:outline-none"
      />
    </div>
  )
}
