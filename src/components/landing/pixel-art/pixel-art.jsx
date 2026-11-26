// Small pixel drawings for the landing: one letter per pixel, '.' is empty. Runs of the same color
// on a row become one rect, so a 16x16 icon stays a few dozen nodes.
const PALETTE = {
  k: '#120c22',
  w: '#efe3c2',
  s: '#c9b78f',
  W: '#ffffff',
  v: '#8a5cff',
  V: '#c3a6ff',
  d: '#5a2fd9',
  y: '#f2c14e',
  Y: '#fff1b0',
  o: '#9a6a1c',
  b: '#c3cbe0',
  e: '#ff7a3d',
  E: '#c4431a',
  g: '#6fe39a',
  G: '#2fae5f',
  m: '#4fa3ff',
  n: '#7a4b2a',
  r: '#d0343f',
}

// outline: every empty pixel touching a drawn one becomes the dark outline.
function outlined(rows) {
  const filled = (x, y) => rows[y]?.[x] !== undefined && rows[y][x] !== '.'
  return rows.map((row, y) =>
    [...row].map((c, x) => (c === '.' && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) ? 'k' : c)).join(''),
  )
}

function runs(rows) {
  const out = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]
      let end = x + 1
      while (end < row.length && row[end] === c) end++
      if (c !== '.') out.push({ x, y, w: end - x, fill: PALETTE[c] })
      x = end
    }
  })
  return out
}

export function PixelArt({ rows, outline = false, className = '', label }) {
  return (
    <svg
      viewBox={`0 0 ${rows[0].length} ${rows.length}`}
      shapeRendering="crispEdges"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    >
      {runs(outline ? outlined(rows) : rows).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height="1" fill={r.fill} />
      ))}
    </svg>
  )
}

// A calendar page with a green tick: the dailies.
export const CALENDAR = [
  '................',
  '...kk......kk...',
  '..kyykkkkkkyyk..',
  '.keeyeeeeeeyeek.',
  '.keeeeeeeeeeeek.',
  '.kEEEEEEEEEEEEk.',
  '.kwwwwwwwwwwwwk.',
  '.kwwwwwwwwwgGwk.',
  '.kwwwwwwwwgGwwk.',
  '.kwgwwwwwgGwwwk.',
  '.kwgGwwwgGwwwwk.',
  '.kwwgGwgGwwwwwk.',
  '.kwwwgGGwwwwwwk.',
  '.kssssssssssssk.',
  '.kkkkkkkkkkkkkk.',
  '................',
]

// Two crossed swords: the duels (outlined when drawn).
export const SWORDS = [
  '................',
  '.W............W.',
  '..Wb........bW..',
  '...Wb......bW...',
  '....Wb....bW....',
  '.....Wb..bW.....',
  '......WbbW......',
  '.......WW.......',
  '......bWWb......',
  '..y..bW..Wb..y..',
  '...ybW....Wby...',
  '....y......y....',
  '...noy....yon...',
  '..nn..y..y..nn..',
  '.yy..........yy.',
  '................',
]

// An answer sheet with one bubble filled in: the ENEM.
export const EXAM = [
  '..kkkkkkkkkkkk..',
  '.kwwwwwwwwwwwwk.',
  '.kwvvvvvvvvwwwk.',
  '.kwwwwwwwwwwwwk.',
  '.kwkkwsssssswwk.',
  '.kwkkwwwwwwwwwk.',
  '.kwwwwwwwwwwwwk.',
  '.kwGGwssssswwwk.',
  '.kwGGwwwwwwwwwk.',
  '.kwwwwwwwwwwwwk.',
  '.kwkkwssssssswk.',
  '.kwkkwwwwwwwwwk.',
  '.kwwwwwwwwwwyyk.',
  '.kssssssssssyyk.',
  '..kkkkkkkkkkkk..',
  '................',
]

// The quest check mark (8x8).
export const TICK = ['........', '......g.', '.....gg.', 'g...gg..', 'gg.gg...', '.ggg....', '..g.....', '........']
