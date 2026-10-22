// 9x9 pixel glyphs for each mission kind: "#" is ink, "o" is the accent color, "." is empty.
const GLYPHS = {
  // A dumbbell: the gym.
  train: ['.........', '.........', '##.....##', '##.....##', '##ooooo##', '##.....##', '##.....##', '.........', '.........'],
  // A page with lines.
  note: ['.######..', '.#oooo##.', '.#ooooo#.', '.#o###o#.', '.#ooooo#.', '.#o###o#.', '.#ooooo#.', '.#o##oo#.', '.#######.'],
  // A clock.
  study: ['..#####..', '.#ooooo#.', '#ooo#ooo#', '#ooo#ooo#', '#ooo##oo#', '#ooooooo#', '#ooooooo#', '.#ooooo#.', '..#####..'],
  // A magnifying glass.
  investigate: ['..####...', '.#oooo#..', '#oo..oo#.', '#o....o#.', '#oo..oo#.', '.#oooo#..', '..####.#.', '.......##', '........#'],
  // A light bulb.
  reflect: ['..#####..', '.#ooooo#.', '#ooooooo#', '#ooo#ooo#', '.#oo#oo#.', '..#ooo#..', '..#####..', '..#####..', '...###...'],
}

function cells(rows, char) {
  return rows.flatMap((row, y) => [...row].map((value, x) => (value === char ? { x, y } : null)).filter(Boolean))
}

export default function KindIcon({ kind, accent = 'primary', className = 'size-5' }) {
  const rows = GLYPHS[kind] ?? GLYPHS.reflect
  return (
    <svg viewBox="0 0 9 9" shapeRendering="crispEdges" aria-hidden="true" className={className}>
      <g className={accent === 'secondary' ? 'fill-secondary' : 'fill-primary'}>
        {cells(rows, 'o').map(({ x, y }) => (
          <rect key={`o${x}-${y}`} x={x} y={y} width="1" height="1" />
        ))}
      </g>
      <g className="fill-ink">
        {cells(rows, '#').map(({ x, y }) => (
          <rect key={`i${x}-${y}`} x={x} y={y} width="1" height="1" />
        ))}
      </g>
    </svg>
  )
}
