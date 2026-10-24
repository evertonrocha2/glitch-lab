import { parseInline } from '../../../../shared/note-blocks.js'

// A line of note text with its marks drawn. Every piece is a text node, so a note can never put
// HTML on the page; links are only http(s) and open in a new tab without the page's referrer.
// Keys are positions: the pieces of one line never move around.
export default function InlineText({ text }) {
  return parseInline(text).map((part, index) => {
    switch (part.type) {
      case 'bold':
        return <strong key={index} className="font-bold">{part.text}</strong>
      case 'italic':
        return <em key={index}>{part.text}</em>
      case 'strike':
        return <s key={index}>{part.text}</s>
      case 'code':
        return (
          <code key={index} className="bg-mist px-1 font-mono text-[0.9em] text-ink">
            {part.text}
          </code>
        )
      case 'link':
        return (
          <a key={index} href={part.href} target="_blank" rel="noopener noreferrer nofollow" className="text-secondary underline underline-offset-2 hover:text-primary">
            {part.text}
          </a>
        )
      default:
        return <span key={index}>{part.text}</span>
    }
  })
}
