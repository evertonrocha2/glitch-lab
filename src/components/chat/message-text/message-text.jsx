import { linkParts } from '../../../../shared/messages.js'

// A message as plain text: every piece is a text node, and only http(s) addresses become links.
// Links leave the site in a new tab and tell the next page nothing about this one.
export default function MessageText({ body, linkClassName = 'underline underline-offset-2' }) {
  return (
    <span className="whitespace-pre-wrap wrap-break-word">
      {linkParts(body).map((part, index) =>
        part.type === 'link' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one fixed text
          <a key={index} href={part.href} target="_blank" rel="noopener noreferrer nofollow" className={linkClassName}>
            {part.value}
          </a>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one fixed text
          <span key={index}>{part.value}</span>
        ),
      )}
    </span>
  )
}
