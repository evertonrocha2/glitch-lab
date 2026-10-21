import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { makeCase } from '../../test/fixtures.js'
import Board from './Board.jsx'
import BoardStats from './BoardStats.jsx'

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

it('explains what each column means', () => {
  render(<Board cases={CASES} onOpen={vi.fn()} />)
  expect(screen.getByText('Just investigated')).toBeInTheDocument()
  expect(screen.getByText('Practicing in the gym')).toBeInTheDocument()
  expect(screen.getByText('Passed 2 challenges')).toBeInTheDocument()
})

it('shows the error type, bug type and progress on each card', () => {
  render(<Board cases={CASES} onOpen={vi.fn()} />)
  const card = screen.getByRole('button', { name: /IndexError: list index out of range/ })
  expect(within(card).getByText('IndexError')).toBeInTheDocument()
  expect(within(card).getByText('list index out of range')).toBeInTheDocument()
  expect(within(card).getByText('Index out of range')).toBeInTheDocument()
  expect(within(card).getByText('python')).toBeInTheDocument()
  const training = screen.getByRole('button', { name: /ReferenceError/ })
  expect(within(training).getByText('1/2 challenges')).toBeInTheDocument()
})

it('opens a case when clicked', async () => {
  const onOpen = vi.fn()
  render(<Board cases={CASES} onOpen={onOpen} />)
  await userEvent.click(screen.getByRole('button', { name: /IndexError: list index out of range/ }))
  expect(onOpen).toHaveBeenCalledWith(CASES[1])
})

it('sums up the board and names the weak spot', () => {
  render(<BoardStats cases={CASES} />)
  const items = within(screen.getByRole('list', { name: 'Board summary' })).getAllByRole('listitem')
  expect(items[0]).toHaveTextContent(/Cases\s*04/)
  expect(items[1]).toHaveTextContent(/Training\s*01/)
  expect(items[2]).toHaveTextContent(/Solved\s*01/)
  expect(items[3]).toHaveTextContent(/Weak spot\s*Reading undefined/)
})

it('has no weak spot when everything is solved', () => {
  render(<BoardStats cases={[makeCase({ status: 'solved', passedCount: 2 })]} />)
  expect(screen.getByText('None yet')).toBeInTheDocument()
})
