// 7x7 pixel icons for the events pages, drawn in the current text color ("#" is filled).
const ICONS = {
  code: ['.......', '.#...#.', '#..#..#', '#..#..#', '#.#...#', '.#...#.', '.......'],
  play: ['#######', '#.#...#', '#.##..#', '#.###.#', '#.##..#', '#.#...#', '#######'],
  globe: ['.#####.', '#.#.#.#', '#######', '#.#.#.#', '#######', '#.#.#.#', '.#####.'],
  clock: ['.#####.', '#..#..#', '#..#..#', '#..###.', '#.....#', '#.....#', '.#####.'],
  people: ['.##..#.', '#..##.#', '#..##.#', '.##..#.', '####.##', '####.##', '.......'],
  arrow: ['.......', '...#...', '....#..', '#######', '....#..', '...#...', '.......'],
  vote: ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..', '..###..'],
}

export default function EventIcon({ name, className = 'size-3.5' }) {
  const rows = ICONS[name]
  return (
    <svg viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" className={`shrink-0 fill-current ${className}`}>
      {rows.flatMap((row, y) => [...row].map((cell, x) => (cell === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)))}
    </svg>
  )
}
