// 9x9 pixel glyphs: "#" is ink, "o" is the accent color, "." is empty.
const GLYPHS = {
  'first-clue': ['..####...', '.#oooo#..', '#oo..oo#.', '#o....o#.', '#o....o#.', '.#oooo#..', '..####.#.', '.......##', '........#'],
  'fixed-it': ['.........', '........#', '.......##', '#.....##.', '##...##..', '.##.##...', '..###....', '...#.....', '.........'],
  'case-closed': ['...###...', '..#...#..', '..#...#..', '.#######.', '.#ooooo#.', '.#oo#oo#.', '.#oo#oo#.', '.#ooooo#.', '.#######.'],
  'sharp-eye': ['.........', '..#####..', '.#.....#.', '#..ooo..#', '#..o#o..#', '#..ooo..#', '.#.....#.', '..#####..', '.........'],
  polyglot: ['.#######.', '#ooooooo#', '#o##o##o#', '#ooooooo#', '#ooooooo#', '.####.##.', '.....#...', '....#....', '.........'],
  'bug-hunter': ['..#...#..', '...#.#...', '..#####..', '#.#ooo#.#', '.##ooo##.', '#.#ooo#.#', '.##ooo##.', '#.#ooo#.#', '..#####..'],
  collector: ['....#####', '....#ooo#', '..#####o#', '..#ooo#o#', '#####o###', '#ooo#o#..', '#ooo###..', '#ooo#....', '#####....'],
  'note-taker': ['......##.', '.....#oo#', '....#oo#.', '...#oo#..', '..#oo#...', '.#oo#....', '.###.....', '.##......', '.#.......'],
  'deep-focus': ['#########', '.#ooooo#.', '..#ooo#..', '...#o#...', '....#....', '...#.#...', '..#.o.#..', '.#ooooo#.', '#########'],
  'on-a-roll': ['....#....', '...#o#...', '..#oo#...', '..#ooo#..', '.#oo#oo#.', '.#o#.#o#.', '#oo#.#oo#', '.#oo#oo#.', '..#####..'],
  unstoppable: ['.....##..', '....#o#..', '...#o#...', '..#ooo##.', '.###oo#..', '...#o#...', '..#o#....', '..##.....', '..#......'],
  marathon: ['#########', '#ooooooo#', '.#ooooo#.', '.#ooooo#.', '..#ooo#..', '...#o#...', '....#....', '..#####..', '.#######.'],
  trailblazer: ['.##......', '.#ooooo#.', '.#oooooo#', '.#ooooo#.', '.######..', '.#.......', '.#.......', '###......', '....#.#.#'],
  'daily-grinder': ['.#.....#.', '#########', '#ooooooo#', '#########', '#......##', '#.....#.#', '#.#..#..#', '#..##...#', '#########'],
  'global-ace': ['..#####..', '.#oo#oo#.', '#oo#o#oo#', '#########', '#oo#o#oo#', '#########', '#oo#o#oo#', '.#oo#oo#.', '..#####..'],
  author: ['.#####...', '.#ooo##..', '.#ooo#o#.', '.#ooo####', '.#o####o#', '.#oooooo#', '.#o####o#', '.#oooooo#', '.########'],
  // A speech bubble with "< >" inside: three languages read in one day.
  'lingo-master': ['.#######.', '#ooooooo#', '#oo#o#oo#', '#o#ooo#o#', '#oo#o#oo#', '#ooooooo#', '.##o####.', '..#o#....', '..##.....'],
  trusted: ['.#######.', '#ooooooo#', '#ooooo#o#', '#oooo#oo#', '#o#o#ooo#', '#oo#oooo#', '.#ooooo#.', '..#ooo#..', '...###...'],
  // Community events: a checkered flag, a trophy and a megaphone.
  competitor: ['#........', '#######..', '#o#o#o#..', '##o#o##..', '#o#o#o#..', '#######..', '#........', '#........', '##.......'],
  champion: ['.#######.', '##ooooo##', '#.#ooo#.#', '.##ooo##.', '...#o#...', '....#....', '...###...', '..#ooo#..', '..#####..'],
  host: ['.......#.', '.....##o#', '..###ooo#', '.#oooooo#', '.#oooooo#', '..###ooo#', '...#.##o#', '...#...#.', '...##....'],
}

function cells(rows, char) {
  return rows.flatMap((row, y) => [...row].map((value, x) => (value === char ? { x, y } : null)).filter(Boolean))
}

export default function BadgeIcon({ id, earned = true, accent = 'primary', className = 'size-10' }) {
  const rows = GLYPHS[id] ?? GLYPHS['first-clue']
  const ink = earned ? 'fill-ink' : 'fill-muted/50'
  const fill = earned ? (accent === 'secondary' ? 'fill-secondary' : 'fill-primary') : 'fill-line'
  return (
    <svg viewBox="0 0 9 9" shapeRendering="crispEdges" aria-hidden="true" className={className}>
      <g className={fill}>
        {cells(rows, 'o').map(({ x, y }) => (
          <rect key={`o${x}-${y}`} x={x} y={y} width="1" height="1" />
        ))}
      </g>
      <g className={ink}>
        {cells(rows, '#').map(({ x, y }) => (
          <rect key={`i${x}-${y}`} x={x} y={y} width="1" height="1" />
        ))}
      </g>
    </svg>
  )
}
