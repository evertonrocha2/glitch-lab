import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { BASES } from '../../../../shared/game/items.js'
import { SUPPORT_IDS } from '../../../../shared/game/skill-mods.js'
import { SKILL_ICONS } from '../../../../shared/game/skills.js'
import { TALENT_ICONS } from '../../../../shared/game/talents.js'
import GameIcon from './game-icon.jsx'
import { iconGrid, RECIPE_NAMES } from './recipes.js'
import { iconCanvas } from './sprite.js'

const used = [
  ...BASES.map((b) => b.icon),
  ...SKILL_ICONS,
  ...TALENT_ICONS,
  'helm',
  'tree',
  'bag',
  'hammer',
  'map',
  'scrap',
  'key',
  'honor',
  'fragment',
  'gold',
]

it('has a recipe for every icon the game modules use', () => {
  for (const name of new Set(used)) expect(RECIPE_NAMES, name).toContain(name)
})

it('has a support gem icon for every support gem', () => {
  for (const id of SUPPORT_IDS) expect(RECIPE_NAMES).toContain(`support-${id}`)
})

it('draws every recipe on a 16x16 grid with at least 20 pixels', () => {
  for (const name of RECIPE_NAMES) {
    const grid = iconGrid(name)
    expect(grid).toHaveLength(16)
    for (const row of grid) expect(row).toHaveLength(16)
    expect(grid.flat().filter(Boolean).length, name).toBeGreaterThanOrEqual(20)
  }
})

it('rejects an unknown icon name', () => {
  expect(() => iconGrid('nope')).toThrow()
})

it('iconCanvas returns null without a 2D context', () => {
  expect(iconCanvas('sword')).toBeNull()
})

it('GameIcon is hidden without a label', () => {
  const { container } = render(<GameIcon name="sword" />)
  expect(container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true')
})

it('GameIcon is an image with a label', () => {
  render(<GameIcon name="sword" label="Espada" size={2} />)
  expect(screen.getByRole('img', { name: 'Espada' })).toBeInTheDocument()
})
