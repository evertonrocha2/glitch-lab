import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { createNote, deleteNote, listCases, listNotes, updateNote } from '../lib/api.js'
import { currentLocation, renderAt } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  listNotes: vi.fn(),
  listCases: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}))

const analysis = { explicacao: 'a', causa: 'b', correcao: 'c', exercicio: { enunciado: 'd', resposta: 'e' } }
const CASES = [
  { id: 'c1', status: 'training', passedCount: 1, error: "TypeError: Cannot read properties of undefined (reading 'length')", code: '', concept: 'undefined-access', language: 'javascript', analysis, createdAt: '2026-10-20T10:00:00Z' },
  { id: 'c2', status: 'new', passedCount: 0, error: 'IndexError: list index out of range', code: '', concept: 'index-out-of-range', language: 'python', analysis, createdAt: '2026-10-20T10:00:00Z' },
]
const NOTE = {
  id: 'n1',
  title: 'Undefined again',
  blocks: [
    { id: 'b1', type: 'text', text: 'Check before reading.' },
    { id: 'b2', type: 'case', caseId: 'c1' },
  ],
  updatedAt: new Date().toISOString(),
}

beforeEach(() => {
  vi.mocked(listNotes).mockReset().mockResolvedValue([NOTE])
  vi.mocked(listCases).mockReset().mockResolvedValue(CASES)
  vi.mocked(createNote).mockReset()
  vi.mocked(updateNote).mockReset().mockImplementation(async (id, fields) => ({ ...NOTE, id, ...fields, updatedAt: new Date().toISOString() }))
  vi.mocked(deleteNote).mockReset().mockResolvedValue()
})

const savedBlocks = () => vi.mocked(updateNote).mock.lastCall[1].blocks

it('lists my notes and opens one with its case', async () => {
  renderAt('/notes', { user: 'alice' })
  await userEvent.click(await screen.findByRole('link', { name: /Undefined again/ }))
  expect(currentLocation()).toBe('/notes/n1')
  expect(screen.getByRole('textbox', { name: 'Note title' })).toHaveValue('Undefined again')
  expect(screen.getByRole('link', { name: 'Open TypeError on the board' })).toHaveAttribute('href', '/board?case=c1')
})

it('starts a new note and opens it', async () => {
  vi.mocked(createNote).mockResolvedValue({ id: 'n2', title: '', blocks: [{ id: 'x', type: 'text', text: '' }], updatedAt: new Date().toISOString() })
  renderAt('/notes', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'New note' }))
  await waitFor(() => expect(currentLocation()).toBe('/notes/n2'))
  expect(screen.getByRole('textbox', { name: 'Note title' })).toHaveValue('')
})

it('mentions a case with @ and saves it', async () => {
  renderAt('/notes/n1', { user: 'alice' })
  const text = await screen.findByRole('textbox', { name: 'Text' })
  await userEvent.type(text, ' See @index')
  const options = within(screen.getByRole('listbox', { name: 'Mention a case' })).getAllByRole('option')
  expect(options).toHaveLength(1)
  expect(options[0]).toHaveTextContent('IndexError: list index out of range')
  await userEvent.keyboard('{Enter}')

  expect(screen.getByRole('link', { name: 'Open IndexError on the board' })).toBeInTheDocument()
  await waitFor(() => expect(updateNote).toHaveBeenCalled(), { timeout: 2000 })
  const blocks = savedBlocks()
  expect(blocks[0]).toMatchObject({ type: 'text', text: 'Check before reading. See' })
  expect(blocks[1]).toMatchObject({ type: 'case', caseId: 'c2' })
  expect(await screen.findByText('Saved')).toBeInTheDocument()
})

it('turns an empty block into a to-do with /', async () => {
  vi.mocked(listNotes).mockResolvedValue([{ ...NOTE, blocks: [{ id: 'b1', type: 'text', text: '' }] }])
  renderAt('/notes/n1', { user: 'alice' })
  await userEvent.type(await screen.findByRole('textbox', { name: 'Text' }), '/')
  await userEvent.click(within(screen.getByRole('listbox', { name: 'Turn into' })).getByRole('option', { name: /To-do/ }))
  await userEvent.type(screen.getByRole('textbox', { name: 'To-do' }), 'Practice ?.{Enter}Second')
  expect(screen.getAllByRole('textbox', { name: 'To-do' })).toHaveLength(2)
  await userEvent.click(screen.getByRole('checkbox', { name: 'Done: Practice ?.' }))
  await waitFor(() => expect(savedBlocks()).toMatchObject([
    { type: 'todo', text: 'Practice ?.', done: true },
    { type: 'todo', text: 'Second', done: false },
  ]), { timeout: 2000 })
})

it('adds a case from the Add bar by searching', async () => {
  renderAt('/notes/n1', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: '@ Case' }))
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search your cases' }), 'python{Enter}')
  expect(screen.getByRole('link', { name: 'Open IndexError on the board' })).toBeInTheDocument()
})

it('deletes a note after confirming', async () => {
  renderAt('/notes/n1', { user: 'alice' })
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
  await waitFor(() => expect(currentLocation()).toBe('/notes'))
  expect(deleteNote).toHaveBeenCalledWith('n1', 'token-alice')
  expect(screen.queryByRole('link', { name: /Undefined again/ })).toBeNull()
})

it('says when a note does not exist', async () => {
  renderAt('/notes/missing', { user: 'alice' })
  expect(await screen.findByText('This note is gone. Pick another one.')).toBeInTheDocument()
})
