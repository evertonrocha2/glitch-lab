import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { BADGES } from '../../../shared/badges.js'
import { BUG } from '../../../shared/bug.js'
import BadgeIcon from './badge-icon/badge-icon.jsx'
import PixelBug from './pixel-bug/pixel-bug.jsx'
import PixelButton from './pixel-button/pixel-button.jsx'
import Working from './working/working.jsx'

it('PixelBug draws one pixel per cell of the bitmap', () => {
  const { container } = render(<PixelBug />)
  const cells = BUG.join('').split('').filter((cell) => cell === 'x').length
  expect(container.querySelectorAll('rect')).toHaveLength(cells)
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})

it('PixelButton is a plain button by default', () => {
  render(<PixelButton disabled>Go</PixelButton>)
  const button = screen.getByRole('button', { name: 'Go' })
  expect(button).toHaveAttribute('type', 'button')
  expect(button).toBeDisabled()
})

it('Working announces progress', () => {
  render(<Working label="Investigating your error" />)
  const status = screen.getByRole('status')
  expect(status).toHaveTextContent('Investigating your error')
  expect(status).toHaveTextContent('The free AI can take a minute or two.')
})

it('BadgeIcon draws its own glyph for every badge', () => {
  const drawings = BADGES.map((badge) => render(<BadgeIcon id={badge.id} />).container.innerHTML)
  expect(new Set(drawings).size).toBe(BADGES.length)
})

it('PixelButton lets a className replace the default padding and text size', async () => {
  const { buttonClasses } = await import('./pixel-button/pixel-button.jsx')
  expect(buttonClasses('primary', '')).toMatch(/\bpx-4\b.*\bpy-2\.5\b.*\btext-xs\b/)
  const small = buttonClasses('ghost', 'px-2 py-1.5 text-[10px]')
  expect(small).not.toMatch(/\bpx-4\b|\bpy-2\.5\b|\btext-xs\b/)
  // Only what is overridden goes: here just the horizontal padding.
  expect(buttonClasses('ghost', 'px-5')).toMatch(/\bpy-2\.5\b/)
  expect(buttonClasses('ghost', 'px-5')).not.toMatch(/\bpx-4\b/)
})

it('PixelButton is at least 40px tall unless a className sets its own min height', async () => {
  const { buttonClasses } = await import('./pixel-button/pixel-button.jsx')
  expect(buttonClasses('primary', '').split(' ')).toContain('min-h-10')
  expect(buttonClasses('ghost', 'min-h-0').split(' ')).not.toContain('min-h-10')
})

it('PixelButton can be hidden on phones', async () => {
  const { buttonClasses } = await import('./pixel-button/pixel-button.jsx')
  const classes = buttonClasses('primary', 'hidden sm:inline-flex')
  expect(classes.split(' ')).not.toContain('inline-flex')
  expect(buttonClasses('primary', '').split(' ')).toContain('inline-flex')
})
