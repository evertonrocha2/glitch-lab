import { parseQuestionText } from '../../../../shared/exams/question-text.js'

// An exam question's text: paragraphs and images, all as text nodes and <img>, never HTML.
export default function QuestionText({ text, className = '' }) {
  const blocks = parseQuestionText(text)
  if (!blocks.length) return null
  return (
    <div className={`space-y-3 break-words text-ink ${className}`}>
      {blocks.map((block, index) =>
        block.type === 'image' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks of one fixed question
          <img key={index} src={block.src} alt={block.alt} loading="lazy" className="h-auto max-w-full border border-line" />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks of one fixed question
          <p key={index} className="whitespace-pre-line leading-relaxed">
            {block.parts.map((part, at) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: pieces of one fixed paragraph
              <span key={at} className={`${part.bold ? 'font-semibold' : ''} ${part.italic ? 'italic' : ''}`.trim() || undefined}>
                {part.text}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  )
}
