// Reads an error message without any AI: its type, the likely language, and the file:line spots it
// points at. The form shows this live, and it decides which uploaded files are worth sending.

const EXTENSIONS = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  java: 'java',
  kt: 'kotlin',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  swift: 'swift',
  dart: 'dart',
  vue: 'javascript',
  svelte: 'javascript',
  sql: 'sql',
  sh: 'shell',
}

// Error names that only one language uses.
const TYPE_LANGUAGE = [
  [/^(IndexError|KeyError|IndentationError|TabError|NameError|AttributeError|ValueError|ZeroDivisionError|ModuleNotFoundError|ImportError|RecursionError)$/, 'python'],
  [/^(ReferenceError|RangeError|URIError|EvalError|UnhandledPromiseRejection)$/, 'javascript'],
  [/(NullPointerException|ArrayIndexOutOfBoundsException|ClassCastException|NumberFormatException)$/, 'java'],
  [/^System\.|NullReferenceException$/, 'csharp'],
  [/^(panic)$/, 'go'],
]

export const extensionOf = (path) => path.split('/').pop().split('.').pop().toLowerCase()
export const languageOfPath = (path) => EXTENSIONS[extensionOf(path)] ?? null
export const isCodePath = (path) => extensionOf(path) in EXTENSIONS

// A path ending in name.ext, plus the ?query dev servers add (cleaned off later).
const FILE = String.raw`[\w@./\\:-]*?[\w-]+\.[A-Za-z]{1,6}(?:\?[\w=&.-]*)?`
const PATTERNS = [
  // Python: File "app/main.py", line 12, in run
  new RegExp(String.raw`File "(${FILE})", line (\d+)`, 'g'),
  // Java: at com.shop.Cart.total(Cart.java:42)
  new RegExp(String.raw`\((${FILE}):(\d+)\)`, 'g'),
  // JS / most others: at fn (src/cart.js:12:5), src/cart.js:12, /home/x/cart.ts:3:1
  new RegExp(String.raw`(?:^|[\s(])(${FILE}):(\d+)(?::(\d+))?`, 'gm'),
]

// Strips the noise a path picks up in a stack trace: file:// URLs, query strings, webpack prefixes.
function cleanPath(raw) {
  return raw
    .replace(/^file:\/\/\/?/, '')
    .replace(/^webpack:\/\/\/?(\.\/)?/, '')
    .replace(/\\/g, '/')
    .replace(/\?.*$/, '')
}

export function findLocations(text) {
  const seen = new Set()
  const locations = []
  for (const pattern of PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const file = cleanPath(match[1])
      if (!isCodePath(file) || /(^|\/)(node_modules|internal)\//.test(file) || file.startsWith('node:')) continue
      const key = `${file}:${match[2]}`
      if (seen.has(key)) continue
      seen.add(key)
      locations.push({ file, line: Number(match[2]), ...(match[3] ? { column: Number(match[3]) } : {}) })
    }
  }
  return locations
}

const TYPE_LINE = /([A-Za-z_$][\w$.]*(?:Error|Exception|Warning)|panic|Traceback)\b\s*:?\s*(.*)/

// { type, message, language, locations }. language is a guess and can be null.
export function scanError(text) {
  const trimmed = text.trim()
  if (!trimmed) return { type: null, message: '', language: null, locations: [] }
  const lines = trimmed.split('\n')
  // Python prints the error last; most others print it first.
  const typed = [...lines].reverse().find((line) => TYPE_LINE.test(line.trim()) && !line.trim().startsWith('Traceback')) ?? lines[0]
  const match = TYPE_LINE.exec(typed.trim())
  const type = match ? match[1] : null
  const message = match ? match[2].trim() : typed.trim()
  const locations = findLocations(trimmed)

  let language = TYPE_LANGUAGE.find(([pattern]) => type && pattern.test(type))?.[1] ?? null
  if (!language && /^Traceback/m.test(trimmed)) language = 'python'
  if (!language) language = locations.map((spot) => languageOfPath(spot.file)).find(Boolean) ?? null
  if (!language && type && /^(TypeError|SyntaxError)$/.test(type)) language = 'javascript'
  return { type, message, language, locations }
}

// The uploaded file a location points at: same path, or the same ending ("src/cart.js" vs "app/src/cart.js").
export function matchFile(files, location) {
  const wanted = location.file.split('/').filter(Boolean)
  let best = null
  let bestScore = 0
  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean)
    let score = 0
    while (score < wanted.length && score < parts.length && wanted[wanted.length - 1 - score] === parts[parts.length - 1 - score]) score++
    if (score > bestScore) {
      best = file
      bestScore = score
    }
  }
  return best
}

// The lines around `line`, numbered, with the error line marked. Keeps big files small enough to send.
export function excerpt(content, line, radius = 25) {
  const lines = content.split('\n')
  const from = Math.max(1, line - radius)
  const to = Math.min(lines.length, line + radius)
  const width = String(to).length
  const body = []
  for (let number = from; number <= to; number++) {
    body.push(`${number === line ? '>>' : '  '} ${String(number).padStart(width)} | ${lines[number - 1]}`)
  }
  const head = from > 1 ? [`   ... lines 1-${from - 1} not shown`] : []
  const tail = to < lines.length ? [`   ... lines ${to + 1}-${lines.length} not shown`] : []
  return [...head, ...body, ...tail].join('\n')
}
