import { useId } from 'react'
import { zoneAt } from '../../../../shared/world/map.js'
import { TILE_PX, TILES } from '../../../../shared/world/tiles.js'
import { AVATAR_STYLES } from '../../ui/pixel-avatar/pixel-avatar.jsx'
import { cameraFor, TILE_SCREEN_PX } from '../camera.js'
import { HERO_FRAMES, LOCK, LOCK_COLORS } from '../hero-sprite.js'

// Each sprite line as runs of one color: [{ x, y, w, pixel }], skipping see-through pixels.
function runsOf(sprite) {
  const runs = []
  sprite.forEach((line, y) => {
    for (let x = 0; x < line.length; ) {
      let end = x + 1
      while (end < line.length && line[end] === line[x]) end++
      if (line[x] !== '.') runs.push({ x, y, w: end - x, pixel: line[x] })
      x = end
    }
  })
  return runs
}

// Pixel runs as rects. paint(pixel) gives { fill } or { className } for each color.
function Pixels({ sprite, paint }) {
  return runsOf(sprite).map(({ x, y, w, pixel }) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height="1" {...paint(pixel)} />)
}

const TILE_ENTRIES = Object.entries(TILES)
const HERO_CLASSES = { k: 'fill-ink', w: 'fill-white' }
const slide = 'motion-safe:transition-transform motion-safe:duration-100 motion-safe:ease-linear'
const translate = (x, y) => ({ transform: `translate(${x * TILE_PX}px, ${y * TILE_PX}px)` })

// A Glitch World map in pixel art: the tiles around the hero, the hero in the player's avatar color, and a
// padlock on the doors of zones still locked. The picture is hidden from screen readers; the game around
// it says in words what happens. Each tile in view can be clicked (onTileClick(x, y)) to walk there.
export default function TileMap({ world, hero, heroColor, lockedZones, viewport, onTileClick }) {
  const prefix = `t${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const { cols, rows } = viewport
  const camera = cameraFor(world, hero, viewport)
  const heroFill = (AVATAR_STYLES[heroColor] ?? AVATAR_STYLES.violet).fill

  // One tile of margin around the view, so nothing blank shows while the camera slides.
  const drawn = []
  const clickable = []
  for (let y = camera.y - 1; y <= camera.y + rows; y++) {
    const row = world.rows[y]
    if (row === undefined) continue
    for (let x = camera.x - 1; x <= camera.x + cols; x++) {
      const char = row[x]
      if (char === undefined) continue
      drawn.push({ x, y, char, locked: char === 'D' && lockedZones.has(zoneAt(world, x, y)?.id) })
      if (x >= camera.x && x < camera.x + cols && y >= camera.y && y < camera.y + rows) clickable.push({ x, y })
    }
  }

  return (
    <svg
      viewBox={`0 0 ${cols * TILE_PX} ${rows * TILE_PX}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      width={cols * TILE_SCREEN_PX}
      className="block h-auto max-w-full touch-manipulation select-none"
    >
      <defs>
        {TILE_ENTRIES.map(([char, tile]) => (
          <g key={char} id={`${prefix}-${tile.name}`}>
            <Pixels sprite={tile.sprite} paint={(pixel) => ({ fill: tile.palette[pixel] })} />
          </g>
        ))}
        <g id={`${prefix}-lock`}>
          <Pixels sprite={LOCK} paint={(pixel) => ({ fill: LOCK_COLORS[pixel] })} />
        </g>
      </defs>
      <g className={slide} style={translate(-camera.x, -camera.y)}>
        {drawn.map(({ x, y, char, locked }) => (
          <g key={`${x},${y}`}>
            <use href={`#${prefix}-${TILES[char].name}`} x={x * TILE_PX} y={y * TILE_PX} />
            {locked && <use data-lock href={`#${prefix}-lock`} transform={`translate(${x * TILE_PX + 2} ${y * TILE_PX + 2}) scale(0.5)`} />}
          </g>
        ))}
        <g data-hero className={slide} style={translate(hero.x, hero.y)}>
          <Pixels sprite={HERO_FRAMES[hero.facing][hero.frame]} paint={(pixel) => ({ className: pixel === 'H' ? heroFill : HERO_CLASSES[pixel] })} />
        </g>
        {clickable.map(({ x, y }) => (
          <rect
            key={`hit-${x},${y}`}
            data-x={x}
            data-y={y}
            x={x * TILE_PX}
            y={y * TILE_PX}
            width={TILE_PX}
            height={TILE_PX}
            fill="transparent"
            className="cursor-pointer"
            onClick={() => onTileClick(x, y)}
          />
        ))}
      </g>
    </svg>
  )
}
