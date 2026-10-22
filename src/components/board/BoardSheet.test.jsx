import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { makeCase } from '../../test/fixtures.js'
import BoardSheet from './BoardSheet.jsx'

const CASES = [
  makeCase({ id: 'c1' }),
  makeCase({
    id: 'c2',
    status: 'training',
    passedCount: 1,
    error: 'IndexError: list index out of range',
    concept: 'index-out-of-range',
    language: 'python',
    analysis: { ...makeCase().analysis, causa: 'The list had 3 items and you asked for the 4th.', pistas: ['It says IndexError.', 'Line 7 reads items[3].'] },
  }),
  makeCase({ id: 'c3', status: 'training', passedCount: 1 }),
]
const NOTES = [
  {
    id: 'n1',
    title: 'Undefined again',
    blocks: [
      { id: 'b1', type: 'case', caseId: 'c1' },
      { id: 'b2', type: 'text', text: '  ' },
      { id: 'b3', type: 'text', text: 'Check before reading.\nEvery time.' },
    ],
  },
  { id: 'n2', title: '', blocks: [] },
]
const PROGRESS = {
  xp: 140,
  level: 2,
  title: 'Junior Detective',
  streak: 3,
  badges: [
    { id: 'first-case', earned: true },
    { id: 'first-pass', earned: true },
    { id: 'solver', earned: false },
  ],
}

const sheet = (props = {}) => render(<BoardSheet cases={CASES} notes={NOTES} progress={PROGRESS} date="Oct 22, 2026" {...props} />)

it('heads the sheet with the board title, the date and my progress', () => {
  sheet()
  expect(screen.getByRole('heading', { level: 1, name: 'Case board' })).toBeInTheDocument()
  expect(screen.getByText('Exported Oct 22, 2026')).toBeInTheDocument()
  const level = screen.getByRole('list', { name: 'Progress' })
  expect(level).toHaveTextContent('Level 2')
  expect(level).toHaveTextContent('Junior Detective')
  expect(level).toHaveTextContent('140 XP')
  expect(level).toHaveTextContent('3 days')
  expect(level).toHaveTextContent('2/3')
})

it('sums up the board', () => {
  sheet()
  const summary = screen.getByRole('list', { name: 'Board summary' })
  expect(within(summary).getByText('Cases').nextSibling).toHaveTextContent('03')
  expect(within(summary).getByText('Training').nextSibling).toHaveTextContent('02')
  expect(within(summary).getByText('Solved').nextSibling).toHaveTextContent('00')
  // Two open "Reading undefined" cases against one index error.
  expect(summary).toHaveTextContent('Reading undefined')
})

it('lists every column with its cases, and says when one is empty', () => {
  sheet()
  const column = (name) => screen.getByRole('region', { name })
  expect(within(column('New')).getAllByRole('article')).toHaveLength(1)
  expect(within(column('Training')).getAllByRole('article')).toHaveLength(2)
  expect(within(column('Solved')).queryAllByRole('article')).toHaveLength(0)
  expect(within(column('Solved')).getByText('Nothing here yet.')).toBeInTheDocument()

  const card = within(column('Training')).getAllByRole('article')[0]
  expect(card).toHaveTextContent('Index out of range')
  expect(card).toHaveTextContent('python')
  expect(card).toHaveTextContent('IndexError')
  expect(card).toHaveTextContent('list index out of range')
  expect(card).toHaveTextContent('1/2')
  expect(card).toHaveTextContent('The list had 3 items and you asked for the 4th.')
  expect(within(card).getAllByRole('listitem').map((item) => item.lastChild.textContent)).toEqual(['It says IndexError.', 'Line 7 reads items[3].'])
  // No clues on a case means no Clues heading.
  expect(within(column('New')).queryByText('Clues')).toBeNull()
})

it('ends with the notes, by title and first lines', () => {
  sheet()
  const notes = screen.getByRole('region', { name: 'Notes' })
  expect(within(notes).getByText('Undefined again')).toBeInTheDocument()
  expect(within(notes).getByText(/Check before reading\./)).toHaveTextContent('Check before reading. Every time.')
  expect(within(notes).getByText('Untitled')).toBeInTheDocument()
})

it('is a picture: nothing to click, and pages only break between cards', () => {
  const { container } = sheet()
  expect(container.querySelectorAll('a, button, input, textarea')).toHaveLength(0)
  for (const card of screen.getAllByRole('article')) expect(card.closest('[data-sheet-block]')).not.toBeNull()
})

it('leaves out the notes and the progress when there are none', () => {
  sheet({ notes: [], progress: null })
  expect(screen.queryByRole('region', { name: 'Notes' })).toBeNull()
  expect(screen.queryByRole('list', { name: 'Progress' })).toBeNull()
})
