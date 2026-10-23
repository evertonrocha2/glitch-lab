import { parseInline, parseReply } from '../../../lib/assistant/conversation.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'

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

// The blinking block at the end of an answer that is still being written. It only blinks when the
// reader allows motion; otherwise it just sits there.
export function TypingCaret() {
  return <span aria-hidden="true" data-testid="typing-caret" className="ml-0.5 inline-block h-[1em] w-[0.5em] translate-y-[0.15em] bg-primary motion-safe:animate-blink" />
}

// caret: the answer is still streaming, so the caret follows its last word.
export default function ReplyText({ text, label, caret = false }) {
  const t = useT()
  const blocks = parseReply(text)
  if (caret && !blocks.length) return <TypingCaret />
  return (
    <div className="space-y-2.5 text-sm leading-relaxed">
      {blocks.map((block, index) => {
        const last = caret && index === blocks.length - 1
        if (block.type === 'code') {
          const code = (
            <pre key={index} className="overflow-x-auto border-2 border-ink bg-mist p-2.5 font-mono text-xs leading-relaxed text-ink">
              <code>{block.text}</code>
            </pre>
          )
          if (!last) return code
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: blocks of a text that only grows at the end.
            <div key={index}>
              {code}
              <TypingCaret />
            </div>
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
                    {last && itemIndex === block.items.length - 1 && <TypingCaret />}
                  </span>
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={index} className="whitespace-pre-line wrap-break-word">
            <Inline text={block.text} />
            {last && <TypingCaret />}
          </p>
        )
      })}
    </div>
  )
}
