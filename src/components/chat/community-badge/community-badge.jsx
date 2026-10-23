import { AVATAR_STYLES } from '../../ui/pixel-avatar/pixel-avatar.jsx'

// 7x7 pixel icons for communities ("#" is filled), in the community's color on a light tile.
export const COMMUNITY_ICON_ROWS = {
  bug: ['#.....#', '.#.#.#.', '..###..', '#######', '..###..', '.#####.', '#..#..#'],
  code: ['.......', '.#...#.', '#..#..#', '#..#..#', '#.#...#', '.#...#.', '.......'],
  chat: ['#######', '#.....#', '#.#.#.#', '#.....#', '#######', '.##....', '.#.....'],
  book: ['.##.##.', '#..#..#', '#..#..#', '#..#..#', '#..#..#', '#######', '.......'],
  rocket: ['...#...', '..###..', '..#.#..', '..###..', '.#####.', '#.###.#', '..#.#..'],
  coffee: ['.#.#...', '#.#....', '#####..', '#...###', '#...#.#', '#...##.', '.###...'],
  star: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '#.....#'],
  globe: ['.#####.', '#.#.#.#', '#######', '#.#.#.#', '#######', '#.#.#.#', '.#####.'],
}

export function PixelIcon({ name, className = 'size-4' }) {
  const rows = COMMUNITY_ICON_ROWS[name] ?? COMMUNITY_ICON_ROWS.bug
  return (
    <svg viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" className={`shrink-0 ${className}`}>
      {rows.flatMap((row, y) => [...row].map((cell, x) => (cell === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)))}
    </svg>
  )
}

// A community's tile: decorative, since its name is always written next to it.
export default function CommunityBadge({ color, icon, className = 'size-12' }) {
  const style = AVATAR_STYLES[color] ?? AVATAR_STYLES.violet
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center border-2 border-ink ${style.tile} ${className}`}>
      <span className={`grid size-3/5 place-items-center ${style.fill}`}>
        <PixelIcon name={icon} className="size-full" />
      </span>
    </span>
  )
}
