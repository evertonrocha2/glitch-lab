// The code editor's VS Code keys, as pure edits. Each takes { value, start, end } (the text and its
// selection) and returns the next one, or null when the key should just do what it always does.

const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' }
const OPENERS = new Set(['(', '[', '{'])
const CLOSERS = new Set([')', ']', '}'])
const QUOTES = new Set(['"', "'", '`'])

const ALIASES = {
  py: 'python',
  python3: 'python',
  rb: 'ruby',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  hs: 'haskell',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  golang: 'go',
  rs: 'rust',
  kt: 'kotlin',
}
const COMMENTS = { python: '#', ruby: '#', shell: '#', r: '#', sql: '--', lua: '--', haskell: '--' }

export const normalizeLanguage = (language) => {
  const key = String(language ?? '').trim().toLowerCase()
  return ALIASES[key] ?? key
}

// "//" unless the language comments with "#" or "--".
export const commentToken = (language) => COMMENTS[normalizeLanguage(language)] ?? '//'

const lineStart = (value, pos) => (pos <= 0 ? 0 : value.lastIndexOf('\n', pos - 1) + 1)
const lineEnd = (value, pos) => {
  const index = value.indexOf('\n', pos)
  return index === -1 ? value.length : index
}
const leading = (line) => line.match(/^[ \t]*/)[0]

// A Python block ("def f():", "if x:"), even when the language isn't known.
const PYTHON_BLOCK = /^\s*(def|class|if|elif|else|for|while|try|except|finally|with|async|match|case)\b.*:\s*$/

// One indent level: what the code already uses (a tab, or its smallest indent of 2 to 4 spaces),
// else 4 spaces in Python and 2 elsewhere.
export function indentUnit(value, language) {
  let smallest = 0
  for (const line of value.split('\n')) {
    if (!line.trim()) continue
    if (line[0] === '\t') return '\t'
    const spaces = line.match(/^ */)[0].length
    if (spaces >= 2 && spaces <= 4 && (!smallest || spaces < smallest)) smallest = spaces
  }
  if (smallest) return ' '.repeat(smallest)
  return normalizeLanguage(language) === 'python' ? '    ' : '  '
}

// The indent for a line typed after `before`: the same, one level deeper after an opening bracket
// or a Python colon.
function nextIndent(value, before, language) {
  const pad = leading(before)
  const last = before.trimEnd().at(-1)
  const lang = normalizeLanguage(language)
  const colon = last === ':' && (lang === 'python' || (!lang && PYTHON_BLOCK.test(before)))
  return OPENERS.has(last) || colon ? pad + indentUnit(value, colon ? 'python' : language) : pad
}

const replace = ({ value }, from, to, text, caret = from + text.length) => ({
  value: value.slice(0, from) + text + value.slice(to),
  start: caret,
  end: caret,
})

// The whole lines a selection touches. One that ends at the start of a line leaves that line out, like VS Code.
function touchedLines(value, start, end) {
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end
  const from = lineStart(value, start)
  const to = lineEnd(value, last)
  return { from, to, lines: value.slice(from, to).split('\n') }
}

// Applies edit(line) = { at, remove, insert } (a column in that line) or null to every touched line,
// and moves the selection with the text.
function editLines(state, edit) {
  const { value, start, end } = state
  const { from, to, lines } = touchedLines(value, start, end)
  const changes = []
  let offset = from
  const edited = lines.map((line, index) => {
    const change = edit(line, index)
    const at = offset
    offset += line.length + 1
    if (!change) return line
    const remove = change.remove ?? 0
    const insert = change.insert ?? ''
    changes.push({ at: at + change.at, remove, insert: insert.length })
    return line.slice(0, change.at) + insert + line.slice(change.at + remove)
  })
  if (!changes.length) return state

  const map = (pos) => {
    let delta = 0
    for (const change of changes) {
      if (pos >= change.at + change.remove) delta += change.insert - change.remove
      else if (pos > change.at) delta += change.at - pos
      else break
    }
    return pos + delta
  }
  // A selection of whole lines keeps starting at the start of its first line.
  const keepStart = start !== end && start === from
  return { value: value.slice(0, from) + edited.join('\n') + value.slice(to), start: keepStart ? start : map(start), end: map(end) }
}

// Tab: one indent level at the caret (spaces up to the next stop), or every selected line one level in.
export function indent(state, language) {
  const { value, start, end } = state
  const unit = indentUnit(value, language)
  if (!value.slice(start, end).includes('\n')) {
    const column = start - lineStart(value, start)
    return replace(state, start, end, unit === '\t' ? unit : ' '.repeat(unit.length - (column % unit.length)))
  }
  return editLines(state, (line) => (line.length ? { at: 0, insert: unit } : null))
}

// Shift+Tab: the touched lines one level out.
export function outdent(state, language) {
  const unit = indentUnit(state.value, language)
  const size = unit === '\t' ? 4 : unit.length
  return editLines(state, (line) => {
    if (line.startsWith('\t')) return { at: 0, remove: 1 }
    const spaces = line.match(/^ */)[0].length
    const remove = Math.min(spaces, spaces % size || size)
    return remove ? { at: 0, remove } : null
  })
}

// Enter: a new line with the same indent, one deeper after an opener. Between a pair like {|}, the
// closer goes to its own line.
export function newline(state, language) {
  const { value, start, end } = state
  const before = value.slice(lineStart(value, start), start)
  const pad = leading(before)
  const inner = nextIndent(value, before, language)
  const last = before.trimEnd().at(-1)
  if (OPENERS.has(last) && value[end] === PAIRS[last]) {
    return replace(state, start, end, `\n${inner}\n${pad}`, start + 1 + inner.length)
  }
  return replace(state, start, end, `\n${inner}`)
}

// Ctrl+Enter: a new line below this one, wherever the caret is in it.
export function lineBelow(state, language) {
  const { value, end } = state
  const at = lineEnd(value, end)
  return replace(state, at, at, `\n${nextIndent(value, value.slice(lineStart(value, at), at), language)}`)
}

// Ctrl+Shift+Enter: a new line above this one.
export function lineAbove(state) {
  const { value, start } = state
  const from = lineStart(value, start)
  const pad = leading(value.slice(from, lineEnd(value, from)))
  return replace(state, from, from, `${pad}\n`, from + pad.length)
}

// Ctrl+/: comments the touched lines, or uncomments them when they all are.
export function toggleComment(state, language) {
  const token = commentToken(language)
  const { lines } = touchedLines(state.value, state.start, state.end)
  const filled = lines.filter((line) => line.trim())
  if (!filled.length) return editLines(state, (line, index) => (index === 0 ? { at: line.length, insert: `${token} ` } : null))
  if (filled.every((line) => line.trimStart().startsWith(token))) {
    return editLines(state, (line) => {
      if (!line.trim()) return null
      const at = leading(line).length
      return { at, remove: token.length + (line[at + token.length] === ' ' ? 1 : 0) }
    })
  }
  const column = Math.min(...filled.map((line) => leading(line).length))
  return editLines(state, (line) => (line.trim() ? { at: column, insert: `${token} ` } : null))
}

// Alt+Up / Alt+Down: the touched lines swap places with the line above or below.
export function moveLines(state, direction) {
  const { value, start, end } = state
  const { from, to } = touchedLines(value, start, end)
  const block = value.slice(from, to)
  if (direction < 0) {
    if (from === 0) return state
    const above = lineStart(value, from - 1)
    const line = value.slice(above, from - 1)
    const shift = line.length + 1
    return { value: `${value.slice(0, above)}${block}\n${line}${value.slice(to)}`, start: start - shift, end: end - shift }
  }
  if (to === value.length) return state
  const below = lineEnd(value, to + 1)
  const line = value.slice(to + 1, below)
  const shift = line.length + 1
  return { value: `${value.slice(0, from)}${line}\n${block}${value.slice(below)}`, start: start + shift, end: end + shift }
}

// Shift+Alt+Up / Shift+Alt+Down: a copy of the touched lines; the selection goes with the copy below.
export function copyLines(state, direction) {
  const { value, start, end } = state
  const { from, to } = touchedLines(value, start, end)
  const block = value.slice(from, to)
  const shift = direction > 0 ? block.length + 1 : 0
  return { value: `${value.slice(0, to)}\n${block}${value.slice(to)}`, start: start + shift, end: end + shift }
}

// Ctrl+Shift+K: deletes the touched lines; the caret keeps its column on the line that takes their place.
export function deleteLines(state) {
  const { value, start, end } = state
  const { from, to } = touchedLines(value, start, end)
  const column = start - from
  let next
  let line
  if (to < value.length) {
    next = value.slice(0, from) + value.slice(to + 1)
    line = from
  } else {
    next = value.slice(0, Math.max(0, from - 1))
    line = lineStart(next, next.length)
  }
  const caret = Math.min(line + column, lineEnd(next, line))
  return { value: next, start: caret, end: caret }
}

// Typing a bracket or quote: closes it (or wraps the selection), and typing a closer that is
// already there steps over it. Null when the character should go in as it is.
export function typeChar(state, char) {
  const { value, start, end } = state
  const after = value[end]
  if (start === end && (CLOSERS.has(char) || QUOTES.has(char)) && after === char) return { value, start: start + 1, end: start + 1 }
  const close = PAIRS[char]
  if (!close) return null
  if (start !== end) {
    return { value: value.slice(0, start) + char + value.slice(start, end) + close + value.slice(end), start: start + 1, end: end + 1 }
  }
  // Before a word it's just the character, and a quote after a letter is an apostrophe ("don't").
  if (after !== undefined && !/[\s)\]},;:]/.test(after)) return null
  const before = value[start - 1]
  if (QUOTES.has(char) && before !== undefined && /[\w\\]/.test(before)) return null
  return replace(state, start, end, char + close, start + 1)
}

// Backspace between an empty pair, like (|), deletes both.
export function deletePair(state) {
  const { value, start, end } = state
  if (start !== end || start === 0) return null
  const open = value[start - 1]
  if (!PAIRS[open] || value[start] !== PAIRS[open]) return null
  return replace(state, start - 1, start + 1, '')
}
