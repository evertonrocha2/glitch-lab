import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { makeCase } from '../../test/fixtures.js'
import Board from './Board.jsx'

const CASES = [
  makeCase({ id: 'a', status: 'new' }),
  makeCase({ id: 'b', status: 'new', error: 'IndexError: list index out of range', concept: 'index-out-of-range', language: 'python' }),
  makeCase({ id: 'c', status: 'training', passedCount: 1, error: 'ReferenceError: x is not defined', concept: 'not-defined' }),
  makeCase({ id: 'd', status: 'solved', passedCount: 2, error: "KeyError: 'email'", concept: 'key-error', language: 'python' }),
]

it('puts each case in its status column', () => {
  render(<Board cases={CASES} onOpen={vi.fn()} />)
  for (const [name, count, items] of [['New', '02', 2], ['Training', '01', 1], ['Solved', '01', 1]]) {
    const column = screen.getByRole('region', { name })
    expect(within(column).getByText(count)).toBeInTheDocument()
    expect(within(column).getAllByRole('listitem')).toHaveLength(items)
  }
})

it('shows the bug type and progress on each card', () => {
  render(<Board cases={CASES} onOpen={vi.fn()} />)
  expect(screen.getByText('Index out of range')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Training' })).getByText('1 of 2 passed')).toBeInTheDocument()
})

it('opens a case when clicked', async () => {
  const onOpen = vi.fn()
  render(<Board cases={CASES} onOpen={onOpen} />)
  await userEvent.click(screen.getByRole('button', { name: /IndexError: list index out of range/ }))
  expect(onOpen).toHaveBeenCalledWith(CASES[1])
})
