import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { AVATAR_COLORS } from '../../../../shared/profile.js'
import { identicon } from '../../../lib/identicon.js'
import PixelAvatar, { AVATAR_STYLES } from './pixel-avatar.jsx'

it('draws one square per filled cell of the identicon', () => {
  const { container } = render(<PixelAvatar seed="ada" color="cobalt" />)
  const filled = identicon('ada').flat().filter(Boolean).length
  expect(container.querySelectorAll('rect')).toHaveLength(filled)
  expect(container.querySelector('svg')).toHaveAttribute('shape-rendering', 'crispEdges')
  expect(container.querySelector('g')).toHaveClass(AVATAR_STYLES.cobalt.fill)
})

it('is decorative by default and an image when given a label', () => {
  const { container, rerender } = render(<PixelAvatar seed="ada" />)
  expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  rerender(<PixelAvatar seed="ada" label="Ada's avatar" />)
  expect(screen.getByRole('img', { name: "Ada's avatar" })).toBeInTheDocument()
})

it('falls back to the first color for an unknown one, and takes its size from className', () => {
  const { container } = render(<PixelAvatar seed="ada" color="neon" className="size-20" />)
  expect(container.querySelector('g')).toHaveClass(AVATAR_STYLES[AVATAR_COLORS[0].id].fill)
  expect(container.firstChild).toHaveClass('size-20')
})

it('has a look for every palette color', () => {
  for (const color of AVATAR_COLORS) expect(AVATAR_STYLES[color.id]).toMatchObject({ fill: expect.any(String), tile: expect.any(String), swatch: expect.any(String) })
})
