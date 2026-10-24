// A textarea can't say where its caret is drawn, so a hidden copy with the same box and font, cut at
// the caret, measures it. Returns { top, left, height } in px from the field's top-left corner.
const COPIED = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'wordSpacing',
  'textIndent',
  'tabSize',
  'wordBreak',
]

export function caretPoint(field, index) {
  const style = getComputedStyle(field)
  const copy = document.createElement('div')
  for (const name of COPIED) copy.style[name] = style[name]
  Object.assign(copy.style, { position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' })
  copy.textContent = field.value.slice(0, index)
  const mark = document.createElement('span')
  // The rest of the text, so the line wraps where the field wraps it.
  mark.textContent = field.value.slice(index) || '.'
  copy.append(mark)
  document.body.append(copy)
  const height = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5 || 24
  const point = { top: mark.offsetTop - field.scrollTop, left: mark.offsetLeft - field.scrollLeft, height }
  copy.remove()
  return point
}
