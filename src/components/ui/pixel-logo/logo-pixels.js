// StudyQuest's mark, "Grimório": an open quest book (cream pages on a violet cover) with a gold
// diamond rune glowing over the spine, on a 16x16 grid. Plain data, so both the React mark
// (pixel-logo.jsx) and the icon script (scripts/make-icons.mjs) draw the same pixels.
export const LOGO_PALETTE = {
  k: '#120c22',
  w: '#efe3c2',
  s: '#c9b78f',
  S: '#a8916a',
  v: '#8a5cff',
  V: '#c3a6ff',
  d: '#5a2fd9',
  y: '#f2c14e',
  Y: '#fff1b0',
  a: '#f2c14e55',
}

export const LOGO_ROWS = [
  '.......yy.......',
  '.....ayYYya.....',
  '.....ayYYya.....',
  '.......yy.......',
  '................',
  '.kkkk......kkkk.',
  'kwwwwkk..kkwwwwk',
  'kwwwwwwkkwwwwwwk',
  'kwSSSwskkswSSSwk',
  'kwwwwwskkswwwwwk',
  'kwSSSwskkswSSSwk',
  'kwwwwwskkswwwwwk',
  'kwwwwwskkswwwwwk',
  'kkkkkkkkkkkkkkkk',
  'kVvvvvvkkvvvvvdk',
  '.kkkkkkkkkkkkkk.',
]

// Large, the dark spine splits the book into two tiles: the detailed cut shades the gutter as a
// fold in the paper instead (same drawing, only the inner spine pixels of the pages change).
export const LOGO_ROWS_DETAILED = LOGO_ROWS.map((row, y) => (y >= 7 && y <= 12 ? `${row.slice(0, 7)}Ss${row.slice(9)}` : row))

// One run of a color on a row: { x, y, width, fill }.
export function logoRuns(rows) {
  const runs = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const cell = row[x]
      let end = x + 1
      while (end < row.length && row[end] === cell) end++
      if (cell !== '.') runs.push({ x, y, width: end - x, fill: LOGO_PALETTE[cell] })
      x = end
    }
  })
  return runs
}
