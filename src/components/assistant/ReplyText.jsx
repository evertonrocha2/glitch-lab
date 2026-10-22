import { parseInline, parseReply } from '../../lib/assistant/conversation.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

// Text, `code` and **bold** as React nodes: the reply is never treated as HTML.
function Inline({ text }) {
  return parseInline(text).map((token, index) => {
    if (token.type === 'code') {
      return (
        // Same font as the sentence around it: code names only get weight, never a font switch.
        // biome-ignore lint/suspicious/noArrayIndexKey: tokens of a fixed text, never reordered.
        <code key={index} className="font-sans font-semibold text-ink">
          {token.text}
        </code>
      )
    }
    // biome-ignore lint/suspicious/noArrayIndexKey: tokens of a fixed text, never reordered.
    if (token.type === 'strong') return <strong key={index}>{token.text}</strong>
    // biome-ignore lint/suspicious/noArrayIndexKey: tokens of a fixed text, never reordered.
    return <span key={index}>{token.text}</span>
  })
}

export default function ReplyText({ text, label }) {
  const t = useT()
  return (
    <div className="space-y-2.5 text-sm leading-relaxed">
      {parseReply(text).map((block, index) => {
        if (block.type === 'code') {
          return (
            <pre key={index} className="overflow-x-auto border-2 border-ink bg-mist p-2.5 font-mono text-xs leading-relaxed text-ink">
              <code>{block.text}</code>
            </pre>
          )
        }
        if (block.type === 'list') {
          return (
            <ul key={index} aria-label={label ? t('app.assistant.replyList', { name: label }) : undefined} className="space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-2">
                  <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 bg-primary" />
                  <span className="min-w-0">
                    <Inline text={item} />
                  </span>
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={index} className="whitespace-pre-line wrap-break-word">
            <Inline text={block.text} />
          </p>
        )
      })}
    </div>
  )
}
