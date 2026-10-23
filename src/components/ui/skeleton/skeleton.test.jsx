import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import Skeleton, { Bone, Field, Line, Lines } from './skeleton.jsx'

it('is one busy status named by its label, with every block hidden from screen readers', () => {
  const { container } = render(
    <Skeleton label="Loading your profile..." className="grid gap-4">
      <Bone className="size-10" />
      <Line className="text-sm" width="w-1/2" />
      <Lines count={3} />
      <Field />
    </Skeleton>,
  )
  const status = screen.getByRole('status', { name: 'Loading your profile...' })
  expect(status).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByText('Loading your profile...')).toHaveClass('sr-only')
  // The layout classes go on the decorative part, which screen readers skip.
  const drawing = status.querySelector('.grid')
  expect(drawing).toHaveAttribute('aria-hidden', 'true')
  expect(drawing).toHaveClass('gap-4')
  // The blocks breathe only when motion is welcome.
  for (const block of container.querySelectorAll('.bg-line')) expect(block).toHaveClass('motion-safe:animate-skeleton')
})

it('draws a paragraph with a shorter last line', () => {
  const { container } = render(<Lines count={3} className="text-sm" last="w-1/3" />)
  const bars = container.querySelectorAll('.bg-line')
  expect(bars).toHaveLength(3)
  expect(bars[0]).toHaveClass('w-full')
  expect(bars[2]).toHaveClass('w-1/3')
})
