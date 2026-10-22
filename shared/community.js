// Community articles: rules shared by the API (which enforces them) and the pages (which hint at them).
// query: longest search, articlesPerDay / commentsPerDay: publishing limits, pageSize: articles per page.
export const COMMUNITY_LIMITS = {
  title: 120,
  body: 12000,
  tags: 5,
  tag: 24,
  comment: 2000,
  query: 80,
  articlesPerDay: 5,
  commentsPerDay: 40,
  pageSize: 10,
}

export const SORTS = [
  { id: 'new', label: 'New' },
  { id: 'top', label: 'Top likes' },
  { id: 'valid', label: 'Most valid' },
]
export const SORT_IDS = SORTS.map((sort) => sort.id)

export const RATINGS = ['valid', 'bad']

const TAG_CHARS = /^[a-z0-9][a-z0-9-]*$/

// A message saying what's wrong with one tag, or null when it's fine.
export function tagProblem(tag) {
  if (tag.length > COMMUNITY_LIMITS.tag) return `Keep each tag up to ${COMMUNITY_LIMITS.tag} characters.`
  if (!TAG_CHARS.test(tag)) return 'Tags use only lowercase letters, numbers and -.'
  return null
}

// "JavaScript, loops #react" or an array of words: trimmed, lowercase, no leading #, no repeats.
export function parseTags(value) {
  const words = Array.isArray(value) ? value : String(value ?? '').split(/[\s,]+/)
  const tags = words.map((word) => String(word).trim().toLowerCase().replace(/^#+/, '')).filter(Boolean)
  return [...new Set(tags)]
}

const FENCE = /^\s*```\s*([\w+#.-]*)\s*$/

// The body is plain text: blank lines split paragraphs, ``` fences hold code. Nothing else is markup,
// so the page can render it as text nodes (no HTML ever comes from an article).
export function parseBody(body) {
  const blocks = []
  let paragraph = []
  let code = null
  const flush = () => {
    const text = paragraph.join('\n').trim()
    if (text) blocks.push({ type: 'paragraph', text })
    paragraph = []
  }
  for (const line of String(body ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    if (code) {
      if (/^\s*```\s*$/.test(line)) {
        blocks.push({ type: 'code', lang: code.lang, text: code.lines.join('\n') })
        code = null
      } else code.lines.push(line)
      continue
    }
    const fence = FENCE.exec(line)
    if (fence) {
      flush()
      code = { lang: fence[1].toLowerCase(), lines: [] }
    } else if (line.trim() === '') flush()
    else paragraph.push(line)
  }
  flush()
  // A fence nobody closed still shows as code, to the end.
  if (code) blocks.push({ type: 'code', lang: code.lang, text: code.lines.join('\n') })
  return blocks
}

// `inline code` pieces of a paragraph. A lone backtick stays plain text.
export function splitInline(text) {
  const parts = []
  const pattern = /`([^`\n]+)`/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ code: false, text: text.slice(last, match.index) })
    parts.push({ code: true, text: match[1] })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ code: false, text: text.slice(last) })
  return parts
}

// The first words of the prose (code blocks left out), for list cards.
export function excerpt(body, max = 220) {
  const prose = parseBody(body)
    .filter((block) => block.type === 'paragraph')
    .map((block) => block.text.replace(/`/g, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (prose.length <= max) return prose
  return `${prose.slice(0, max).replace(/\s+\S*$/, '')}…`
}

// Search text: letters, numbers, spaces and a few code-ish symbols, so it is safe to put in any filter.
export function cleanQuery(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[^\p{L}\p{N} _.@#+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, COMMUNITY_LIMITS.query)
    .trim()
}
