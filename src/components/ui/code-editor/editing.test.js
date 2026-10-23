import { describe, expect, it } from 'vitest'
import {
  commentToken,
  copyLines,
  deleteLines,
  deletePair,
  indent,
  indentUnit,
  lineAbove,
  lineBelow,
  moveLines,
  newline,
  outdent,
  toggleComment,
  typeChar,
} from './editing.js'

// Text with the selection drawn in: "|" is the caret, "<" and ">" the ends of a selection.
function parse(text) {
  if (text.includes('|')) {
    const start = text.indexOf('|')
    return { value: text.replace('|', ''), start, end: start }
  }
  const start = text.indexOf('<')
  const end = text.indexOf('>') - 1
  return { value: text.replace('<', '').replace('>', ''), start, end }
}
function show({ value, start, end }) {
  if (start === end) return `${value.slice(0, start)}|${value.slice(start)}`
  return `${value.slice(0, start)}<${value.slice(start, end)}>${value.slice(end)}`
}
const run = (edit, text, ...args) => {
  const next = edit(parse(text), ...args)
  return next && show(next)
}

describe('Tab and Shift+Tab', () => {
  it('Tab puts two spaces at the caret, up to the next stop', () => {
    expect(run(indent, 'if (x) {\n|}')).toBe('if (x) {\n  |}')
    expect(run(indent, 'a|b')).toBe('a |b')
  })

  it('Tab replaces a selection inside one line', () => {
    expect(run(indent, 'a<bc>d')).toBe('a |d')
  })

  it('Tab indents every selected line and keeps the selection on them', () => {
    expect(run(indent, '<one\ntwo>\nthree')).toBe('<  one\n  two>\nthree')
    expect(run(indent, 'o<ne\n\ntw>o')).toBe('  o<ne\n\n  tw>o')
  })

  it('leaves out a last line the selection only touches at its start', () => {
    expect(run(indent, '<one\n>two')).toBe('<  one\n>two')
  })

  it('Shift+Tab outdents the caret line or the selected lines', () => {
    expect(run(outdent, 'if x:\n    ret|urn')).toBe('if x:\nret|urn')
    expect(run(outdent, '  a\n    ret|urn')).toBe('  a\n  ret|urn')
    expect(run(outdent, '<  one\n   two\nthree>')).toBe('<one\n  two\nthree>')
    expect(run(outdent, '\tx|')).toBe('x|')
  })

  it('Shift+Tab on a line with no indent changes nothing', () => {
    const state = parse('x|')
    expect(outdent(state)).toBe(state)
  })
})

describe('indent level', () => {
  it('follows the code, else 4 spaces in Python and 2 elsewhere', () => {
    expect(indentUnit('if x:\n\tpass')).toBe('\t')
    expect(indentUnit('def f():\n    if x:\n        pass', 'javascript')).toBe('    ')
    expect(indentUnit('a\n  b\n    c', 'python')).toBe('  ')
    expect(indentUnit('x = 1', 'python')).toBe('    ')
    expect(indentUnit('x = 1')).toBe('  ')
  })

  it('Tab and Enter use it', () => {
    expect(run(indent, 'def f():\n    pass\n|')).toBe('def f():\n    pass\n    |')
    expect(run(newline, 'if x {\n\ty {|', 'go')).toBe('if x {\n\ty {\n\t\t|')
  })
})

describe('Enter', () => {
  it('keeps the line indent', () => {
    expect(run(newline, '    total += 1|')).toBe('    total += 1\n    |')
  })

  it('goes one level in after an opening bracket', () => {
    expect(run(newline, 'const list = [|')).toBe('const list = [\n  |')
    expect(run(newline, '  call(|')).toBe('  call(\n    |')
  })

  it('puts the closer on its own line between a pair', () => {
    expect(run(newline, 'if (ok) {|}')).toBe('if (ok) {\n  |\n}')
    expect(run(newline, '  f(|)')).toBe('  f(\n    |\n  )')
  })

  it('goes in after a colon in Python, and after a Python block when the language is unknown', () => {
    expect(run(newline, 'for n in nums:|', 'python')).toBe('for n in nums:\n    |')
    expect(run(newline, 'def f():|')).toBe('def f():\n    |')
    expect(run(newline, 'const a = { b:|', 'javascript')).toBe('const a = { b:\n|')
  })

  it('replaces a selection', () => {
    expect(run(newline, '  a<bc>d')).toBe('  a\n  |d')
  })
})

describe('Ctrl+Enter and Ctrl+Shift+Enter', () => {
  it('adds a line below from anywhere in the line', () => {
    expect(run(lineBelow, '  con|st a = 1\nnext')).toBe('  const a = 1\n  |\nnext')
    expect(run(lineBelow, 'if (x) {|')).toBe('if (x) {\n  |')
  })

  it('adds a line above with the same indent', () => {
    expect(run(lineAbove, 'first\n    sec|ond')).toBe('first\n    |\n    second')
  })
})

describe('Ctrl+/', () => {
  it('comments the caret line with the language token', () => {
    expect(run(toggleComment, '  const a = 1|')).toBe('  // const a = 1|')
    expect(run(toggleComment, 'print(x)|', 'python')).toBe('# print(x)|')
    expect(run(toggleComment, 'SELECT 1|', 'sql')).toBe('-- SELECT 1|')
  })

  it('uncomments when every line is commented', () => {
    expect(run(toggleComment, '  // const a = 1|')).toBe('  const a = 1|')
    expect(run(toggleComment, '<# a\n#b>', 'py')).toBe('<a\nb>')
  })

  it('comments several lines at their smallest indent, skipping blank ones', () => {
    expect(run(toggleComment, '<if (x) {\n\n  y()\n}>')).toBe('<// if (x) {\n\n//   y()\n// }>')
  })

  it('knows each family of comment tokens', () => {
    expect(['javascript', 'ts', 'java', 'c', 'cpp', 'c#', 'go', 'rust', 'kotlin', 'swift', 'php'].map(commentToken)).toEqual(Array(11).fill('//'))
    expect(['python', 'ruby', 'bash', 'r'].map(commentToken)).toEqual(['#', '#', '#', '#'])
    expect(['sql', 'lua', 'haskell'].map(commentToken)).toEqual(['--', '--', '--'])
    expect(commentToken(undefined)).toBe('//')
  })
})

describe('Alt+Up and Alt+Down', () => {
  it('moves the caret line up and down, caret and all', () => {
    expect(run(moveLines, 'a\nb|b\nc', -1)).toBe('b|b\na\nc')
    expect(run(moveLines, 'a\nb|b\nc', 1)).toBe('a\nc\nb|b')
  })

  it('moves a block of selected lines', () => {
    expect(run(moveLines, 'top\n<one\ntwo>\nend', -1)).toBe('<one\ntwo>\ntop\nend')
  })

  it('stays put at the edges', () => {
    expect(run(moveLines, 'a|\nb', -1)).toBe('a|\nb')
    expect(run(moveLines, 'a\nb|', 1)).toBe('a\nb|')
  })
})

describe('Shift+Alt+Up and Shift+Alt+Down', () => {
  it('copies the line, the caret going with the copy below', () => {
    expect(run(copyLines, 'x = 1|\ny', 1)).toBe('x = 1\nx = 1|\ny')
    expect(run(copyLines, 'x = 1|\ny', -1)).toBe('x = 1|\nx = 1\ny')
  })

  it('copies a block of lines', () => {
    expect(run(copyLines, '<a\nb>', 1)).toBe('a\nb\n<a\nb>')
  })
})

describe('Ctrl+Shift+K', () => {
  it('deletes the line, keeping the caret column on the next one', () => {
    expect(run(deleteLines, 'one\ntw|o\nthree')).toBe('one\nth|ree')
  })

  it('deletes the last line and lands on the one above', () => {
    expect(run(deleteLines, 'long line\nx|')).toBe('l|ong line')
  })

  it('deletes every selected line, down to an empty editor', () => {
    expect(run(deleteLines, '<a\nb>')).toBe('|')
  })
})

describe('brackets and quotes', () => {
  it('closes an opener and puts the caret inside', () => {
    expect(run(typeChar, 'call|', '(')).toBe('call(|)')
    expect(run(typeChar, 'x = |', '{')).toBe('x = {|}')
    expect(run(typeChar, 'say |', '"')).toBe('say "|"')
  })

  it('steps over a closer that is already there', () => {
    expect(run(typeChar, 'call(|)', ')')).toBe('call()|')
    expect(run(typeChar, 'say "hi|"', '"')).toBe('say "hi"|')
  })

  it('wraps a selection', () => {
    expect(run(typeChar, 'a <b> c', '(')).toBe('a (<b>) c')
    expect(run(typeChar, '<name>', "'")).toBe("'<name>'")
  })

  it('types just the character before a word, and an apostrophe after a letter', () => {
    expect(run(typeChar, '|value', '(')).toBeNull()
    expect(run(typeChar, 'don|', "'")).toBeNull()
    expect(run(typeChar, 'a|', 'b')).toBeNull()
  })

  it('Backspace between an empty pair deletes both', () => {
    expect(run(deletePair, 'f(|)')).toBe('f|')
    expect(run(deletePair, "x = '|'")).toBe('x = |')
    expect(run(deletePair, 'f(a|)')).toBeNull()
  })
})
