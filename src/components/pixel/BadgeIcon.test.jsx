import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { BADGES } from '../../../shared/badges.js'
import BadgeIcon from './BadgeIcon.jsx'

const drawing = (id) => render(<BadgeIcon id={id} />).container.innerHTML

it('draws every badge with its own glyph', () => {
  const drawings = BADGES.map((badge) => drawing(badge.id))
  expect(new Set(drawings).size).toBe(BADGES.length)
})
