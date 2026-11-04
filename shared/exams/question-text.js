// The markdown an exam question comes with (from api.enem.dev), read into blocks the page renders as
// text nodes and <img>: never as HTML, so nothing in a question can put markup on the page.
//   { type: 'paragraph', parts: [{ text, bold?, italic? }] }
//   { type: 'image', src, alt }
// Only https images are kept, and never the placeholder the source uses for a broken one.

// The whole line is the image: the URL runs to the last ")" (some have parentheses of their own).
const IMAGE_LINE = /^!\[([^\]]*)\]\((\S*)\)$/
const INLINE = /\*\*(.+?)\*\*|\*(\S(?:.*?\S)?)\*|(?<![\w])_(\S(?:.*?\S)?)_(?![\w])/g

const safeImage = (src) => src.startsWith('https://') && !src.includes('broken-image')

function inlineParts(text) {
  const parts = []
  const push = (part) => {
    const last = parts.at(-1)
    if (last && !last.bold && !last.italic && !part.bold && !part.italic) last.text += part.text
    else parts.push(part)
  }
  let at = 0
  for (const match of text.matchAll(INLINE)) {
    if (match.index > at) push({ text: text.slice(at, match.index) })
    if (match[1] !== undefined) push({ text: match[1], bold: true })
    else push({ text: match[2] ?? match[3], italic: true })
    at = match.index + match[0].length
  }
  if (at < text.length) push({ text: text.slice(at) })
  return parts
}

function paragraph(lines) {
  const text = lines.join('\n').trim()
  return text ? { type: 'paragraph', parts: inlineParts(text) } : null
}

export function parseQuestionText(markdown) {
  if (typeof markdown !== 'string') return []
  const blocks = []
  for (const chunk of markdown.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    // A markdown line break ("  \n") reads the same as a plain one.
    let lines = []
    for (const raw of chunk.split('\n')) {
      const line = raw.replace(/\s+$/, '')
      const image = IMAGE_LINE.exec(line.trim())
      if (!image) {
        lines.push(line)
        continue
      }
      const before = paragraph(lines)
      if (before) blocks.push(before)
      lines = []
      if (safeImage(image[2])) blocks.push({ type: 'image', src: image[2], alt: image[1] })
    }
    const rest = paragraph(lines)
    if (rest) blocks.push(rest)
  }
  return blocks
}
