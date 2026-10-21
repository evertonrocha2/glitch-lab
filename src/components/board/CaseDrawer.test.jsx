import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { makeCase } from '../../test/fixtures.js'
import CaseDrawer from './CaseDrawer.jsx'

it('shows the study notes and Train this', async () => {
  const onTrain = vi.fn()
  const item = makeCase()
  render(<CaseDrawer item={item} onClose={vi.fn()} onTrain={onTrain} training={false} />)
  const dialog = screen.getByRole('dialog', { name: "TypeError: Cannot read properties of undefined (reading 'length')" })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(screen.getByRole('heading', { name: 'What happened' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Train this' }))
  expect(onTrain).toHaveBeenCalledWith(item)
})

it('closes on Escape and on Close', async () => {
  const onClose = vi.fn()
  render(<CaseDrawer item={makeCase()} onClose={onClose} onTrain={vi.fn()} training={false} />)
  await userEvent.keyboard('{Escape}')
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(2)
})

it('offers more practice on a solved case without overcounting', () => {
  render(<CaseDrawer item={makeCase({ status: 'solved', passedCount: 2 })} onClose={vi.fn()} onTrain={vi.fn()} training={false} />)
  expect(screen.getByRole('button', { name: 'Practice again' })).toBeEnabled()
  expect(screen.getByText('2/2 challenges passed')).toBeInTheDocument()
})

it('gives focus back to what was focused before it opened', () => {
  render(<button type="button">The card</button>)
  const card = screen.getByRole('button', { name: 'The card' })
  card.focus()
  const { unmount } = render(<CaseDrawer item={makeCase()} onClose={vi.fn()} onTrain={vi.fn()} training={false} />)
  expect(card).not.toHaveFocus()
  unmount()
  expect(card).toHaveFocus()
})

it('blocks Train this while a challenge is being prepared', () => {
  render(<CaseDrawer item={makeCase()} onClose={vi.fn()} onTrain={vi.fn()} training />)
  expect(screen.getByRole('button', { name: 'Preparing your challenge...' })).toBeDisabled()
})
