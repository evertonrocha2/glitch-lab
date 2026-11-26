import { screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderAt } from '../test/render.jsx'
import { isEmbedded, STUDY_FRAME_NAME, withEmbed } from './embed.js'

vi.mock('../lib/api.js', () => ({
  AuthError: class extends Error {},
  listCases: vi.fn().mockResolvedValue([]),
  listNotes: vi.fn().mockResolvedValue([]),
}))

afterEach(() => {
  window.name = ''
})

it('adds embed=1 to a study link, keeping its own query', () => {
  expect(withEmbed('/daily')).toBe('/daily?embed=1')
  expect(withEmbed('/exams/enem?topic=x')).toBe('/exams/enem?topic=x&embed=1')
  expect(withEmbed('/hunt?embed=1')).toBe('/hunt?embed=1')
})

it('is embedded with embed=1 in the URL or inside the study window frame', () => {
  expect(isEmbedded('')).toBe(false)
  expect(isEmbedded('?embed=1')).toBe(true)
  expect(isEmbedded('?embed=0')).toBe(false)
  // A link followed inside the window drops the query; the frame's name keeps it embedded.
  window.name = STUDY_FRAME_NAME
  expect(isEmbedded('')).toBe(true)
})

it('shows a signed-in page with its header, nav and corner widgets normally', () => {
  renderAt('/board', { user: 'alice' })
  expect(screen.getByRole('banner')).toBeInTheDocument()
  expect(screen.getByRole('main')).toBeInTheDocument()
})

it('shows only the page, without the header, nav, study timer or assistant, in embed mode', () => {
  renderAt('/board?embed=1', { user: 'alice' })
  expect(screen.getByRole('main')).toBeInTheDocument()
  expect(screen.queryByRole('banner')).toBeNull()
  expect(screen.queryByRole('navigation')).toBeNull()
  expect(screen.queryByRole('region', { name: 'Study timer' })).toBeNull()
  expect(screen.queryByRole('button', { name: /assistant/i })).toBeNull()
})
