import { parseBody, splitInline } from '../../../shared/community.js'

// Paragraphs, `inline code` and fenced code blocks. Everything is a text node: an article can
// never put HTML on the page, whatever its author types.
function Inline({ text }) {
  return splitInline(text).map((part, index) =>
    part.code ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: pieces of one fixed paragraph
      <code key={index} className="border border-line bg-mist px-1 py-px font-mono text-[0.9em] text-primary-strong">
        {part.text}
      </code>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: pieces of one fixed paragraph
      <span key={index}>{part.text}</span>
    ),
  )
}

export default function ArticleBody({ body }) {
  const blocks = parseBody(body)
  if (!blocks.length) return <p className="text-muted">Nothing written yet.</p>
  return (
    <div className="space-y-5 text-[17px] leading-relaxed text-ink">
      {blocks.map((block, index) =>
        block.type === 'code' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks of one fixed body
          <figure key={index} className="border-2 border-ink bg-white shadow-pixel-secondary">
            {block.lang && <figcaption className="border-b-2 border-ink bg-secondary-soft px-3 py-1 font-label text-[10px] text-secondary">{block.lang}</figcaption>}
            <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
              <code>{block.text}</code>
            </pre>
          </figure>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks of one fixed body
          <p key={index} className="whitespace-pre-line break-words">
            <Inline text={block.text} />
          </p>
        ),
      )}
    </div>
  )
}
