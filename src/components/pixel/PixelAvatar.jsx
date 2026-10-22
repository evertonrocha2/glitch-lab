import { useMemo } from 'react'
import { AVATAR_COLORS } from '../../../shared/profile.js'
import { IDENTICON_SIZE, identicon } from '../../lib/identicon.js'

// Pixels in the chosen color on a light tile of the same family. swatch is the solid color for pickers.
export const AVATAR_STYLES = {
  violet: { fill: 'fill-primary', tile: 'bg-primary-soft', swatch: 'bg-primary' },
  cobalt: { fill: 'fill-secondary', tile: 'bg-secondary-soft', swatch: 'bg-secondary' },
  grape: { fill: 'fill-[#4a1fb8]', tile: 'bg-primary-soft', swatch: 'bg-[#4a1fb8]' },
  sky: { fill: 'fill-[#2f7df6]', tile: 'bg-secondary-soft', swatch: 'bg-[#2f7df6]' },
  ink: { fill: 'fill-ink', tile: 'bg-mist', swatch: 'bg-ink' },
}

// A symmetric 8x8 pixel face made from the seed, framed like every other Pixel Lab tile.
// Decorative unless a label is given. Size comes from className (size-10 by default).
export default function PixelAvatar({ seed, color, label, className = 'size-10' }) {
  const style = AVATAR_STYLES[color] ?? AVATAR_STYLES[AVATAR_COLORS[0].id]
  const grid = useMemo(() => identicon(seed ?? ''), [seed])
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }
  return (
    <span {...a11y} className={`inline-block shrink-0 border-2 border-ink ${style.tile} ${className}`}>
      {/* One empty cell of margin on every side, so the pixels don't touch the border. */}
      <svg viewBox={`-1 -1 ${IDENTICON_SIZE + 2} ${IDENTICON_SIZE + 2}`} shapeRendering="crispEdges" className="block size-full">
        <g className={style.fill}>
          {grid.flatMap((row, y) =>
            row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)),
          )}
        </g>
      </svg>
    </span>
  )
}
