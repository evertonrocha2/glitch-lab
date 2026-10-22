import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { BADGES } from '../../../shared/badges.js'
import { BUG } from '../../../shared/bug.js'
import BadgeIcon from './BadgeIcon.jsx'
import PixelBug from './PixelBug.jsx'
import PixelButton from './PixelButton.jsx'
import Working from './Working.jsx'

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
