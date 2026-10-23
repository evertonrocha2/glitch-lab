import { screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { getPublicNote } from '../../lib/api.js'
import { renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  getMyProfile: vi.fn().mockResolvedValue(null),
  getPublicNote: vi.fn(),
}))

const SHARED = {
  note: {
    id: 'n1',
    title: 'Reading undefined',
    updatedAt: '2026-10-21T12:00:00Z',
    blocks: [
      { id: 'b1', type: 'heading', text: 'What I learned' },
      { id: 'b2', type: 'text', text: 'Check the object before going deeper.' },
      { id: 'b3', type: 'todo', text: 'Use ?. in my project', done: true },
      { id: 'b4', type: 'todo', text: 'Pass the second gym round', done: false },
      {
        id: 'b5',
        type: 'case',
        case: { errorType: 'TypeError', message: "Cannot read properties of undefined (reading 'name')", bugType: 'Reading undefined', language: 'javascript', status: 'solved' },
      },
      { id: 'b6', type: 'case', case: null },
    ],
  },
  author: {
    handle: 'ada_dev',
    displayName: 'Ada',
    avatar: { seed: 'abc', color: 'cobalt' },
    role: 'student',
    headline: 'Learning React at night',
    university: 'Infnet',
    work: '',
    location: '',
    languages: ['javascript'],
  },
}

beforeEach(() => {
  vi.mocked(getPublicNote).mockReset().mockResolvedValue(SHARED)
})

it('shows a shared note read-only to a signed-out visitor', async () => {
  renderAt('/u/ada_dev/notes/n1')
  expect(await screen.findByRole('heading', { name: 'Reading undefined', level: 1 })).toBeInTheDocument()
  expect(vi.mocked(getPublicNote).mock.lastCall).toEqual(['ada_dev', 'n1'])
  expect(screen.getByRole('heading', { name: 'What I learned', level: 2 })).toBeInTheDocument()
  expect(screen.getByText('Check the object before going deeper.')).toBeInTheDocument()

  const todos = screen.getByRole('list', { name: 'To-dos' })
  expect(within(todos).getAllByRole('listitem')).toHaveLength(2)
  expect(within(todos).getByText('Use ?. in my project')).toBeInTheDocument()
  expect(within(todos).getByText('(done)')).toBeInTheDocument()

  const kase = screen.getByRole('figure', { name: 'Case: TypeError' })
  expect(within(kase).getByText("Cannot read properties of undefined (reading 'name')")).toBeInTheDocument()
  expect(within(kase).getByText('Reading undefined')).toBeInTheDocument()
  expect(within(kase).getByText('javascript')).toBeInTheDocument()
  expect(within(kase).getByText('Solved')).toBeInTheDocument()
  expect(screen.getByText('This case is private.')).toBeInTheDocument()

  // Nothing to edit or open.
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  expect(screen.queryByRole('link', { name: /on the board/ })).toBeNull()
})

it('shows the author and links back to their profile', async () => {
  renderAt('/u/ada_dev/notes/n1')
  const author = await screen.findByRole('region', { name: 'Written by' })
  expect(within(author).getByRole('link', { name: 'Ada' })).toHaveAttribute('href', '/u/ada_dev')
  expect(within(author).getByText('Learning React at night')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Back to @ada_dev/ })).toHaveAttribute('href', '/u/ada_dev')
})

it('says so kindly when the note is not shared', async () => {
  vi.mocked(getPublicNote).mockResolvedValue(null)
  renderAt('/u/ada_dev/notes/secret')
  expect(await screen.findByRole('heading', { name: 'This note is not shared' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Back to @ada_dev/ })).toHaveAttribute('href', '/u/ada_dev')
})

it('shows the error when the note cannot load', async () => {
  vi.mocked(getPublicNote).mockRejectedValue(new Error('Could not reach the server. Check your connection.'))
  renderAt('/u/ada_dev/notes/n1')
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.')
})

it('speaks Brazilian Portuguese, the case summary included', async () => {
  renderAt('/u/ada_dev/notes/n1', { locale: 'pt-BR' })
  await screen.findByRole('heading', { name: 'Reading undefined', level: 1 })
  expect(screen.getByText(/Atualizada em 21 de out\. de 2026 · 2 casos/)).toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'Tarefas' })).toBeInTheDocument()
  const kase = screen.getByRole('figure', { name: 'Caso: TypeError' })
  expect(within(kase).getByText('Lendo undefined')).toBeInTheDocument()
  expect(within(kase).getByText('Resolvido')).toBeInTheDocument()
  expect(screen.getByText('Este caso é privado.')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Escrita por' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Voltar para @ada_dev/ })).toHaveAttribute('href', '/u/ada_dev')
})
