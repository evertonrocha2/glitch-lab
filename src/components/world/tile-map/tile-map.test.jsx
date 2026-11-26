import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { worldById } from '../../../../shared/world/worlds.js'
import TileMap from './tile-map.jsx'

const forest = worldById('floresta-js')
const draw = (props = {}) =>
  render(
    <TileMap
      world={forest}
      hero={{ x: 3, y: 10, facing: 'down', frame: 0 }}
      heroColor="cobalt"
      lockedZones={new Set(['z2', 'z3'])}
      viewport={{ cols: 7, rows: 7 }}
      onTileClick={() => {}}
      {...props}
    />,
  )
const clickable = (container) => container.querySelectorAll('[data-x]')

it('makes only the tiles in view clickable, and hides the picture from screen readers', () => {
  const { container } = draw()
  expect(clickable(container)).toHaveLength(49)
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(container.querySelector('svg')).toHaveAttribute('shape-rendering', 'crispEdges')
  // Camera centered on (3,10), stopped at the left edge: columns 0 to 6, rows 7 to 13.
  const xs = [...clickable(container)].map((tile) => Number(tile.dataset.x))
  const ys = [...clickable(container)].map((tile) => Number(tile.dataset.y))
  expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([0, 6, 7, 13])
})

it('reports the tile that was clicked', async () => {
  const onTileClick = vi.fn()
  const { container } = draw({ onTileClick })
  await userEvent.click(container.querySelector('[data-x="5"][data-y="9"]'))
  expect(onTileClick).toHaveBeenCalledWith(5, 9)
})

it('marks doors of locked zones with a lock, and open ones without', () => {
  const near = { hero: { x: 11, y: 10, facing: 'right', frame: 0 } }
  expect(draw(near).container.querySelectorAll('[data-lock]')).toHaveLength(1)
  expect(draw({ ...near, lockedZones: new Set() }).container.querySelectorAll('[data-lock]')).toHaveLength(0)
})

it('paints the hero in the avatar color', () => {
  const { container } = draw({ heroColor: 'grape' })
  const classes = [...container.querySelectorAll('[data-hero] rect')].map((rect) => rect.getAttribute('class'))
  expect(classes).toContain('fill-[#4a1fb8]')
  expect(classes).toContain('fill-ink')
})
