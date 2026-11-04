import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { getExam, joinTrack } from '../../lib/api.js'
import { renderAt } from '../../test/render.jsx'

vi.mock('../../lib/api.js', () => ({
  AuthError: class extends Error {},
  getProgress: vi.fn().mockResolvedValue(null),
  addStudyTime: vi.fn(),
  startStudySession: vi.fn(),
  stopStudySession: vi.fn(),
  getExam: vi.fn(),
  joinTrack: vi.fn(),
}))

const topic = (id, name, stats = {}) => ({ id, name, questions: 0, answered: 0, correct: 0, ...stats })

const examWith = (overrides = {}) => ({
  id: 'enem',
  name: 'ENEM',
  joined: true,
  examDate: null,
  areas: [
    { id: 'linguagens', name: 'Linguagens, Códigos e suas Tecnologias', shortName: 'Linguagens', topics: [topic('literatura', 'Literatura', { questions: 12 })] },
    {
      id: 'matematica',
      name: 'Matemática e suas Tecnologias',
      shortName: 'Matemática',
      topics: [topic('funcoes', 'Funções', { questions: 30, answered: 4, correct: 3 }), topic('trigonometria', 'Trigonometria')],
    },
  ],
  ...overrides,
})

beforeEach(() => {
  vi.mocked(getExam).mockReset().mockResolvedValue(examWith())
  vi.mocked(joinTrack).mockReset().mockResolvedValue({ id: 'enem', examDate: '2027-11-07' })
})

it('shows areas and topics with my stats', async () => {
  renderAt('/exams/enem', { user: 'ana', locale: 'pt-BR' })
  expect(await screen.findByRole('heading', { name: 'Matemática' })).toBeInTheDocument()
  expect(getExam).toHaveBeenCalledWith('enem', 'token-ana')
  const link = screen.getByRole('link', { name: /Funções/ })
  expect(link).toHaveAttribute('href', '/exams/enem/funcoes')
  expect(within(link).getByText('3 de 4 certas · 30 questões')).toBeInTheDocument()
  expect(screen.queryByText('Estudar para o ENEM')).not.toBeInTheDocument()
})

it('marks empty topics as coming soon', async () => {
  renderAt('/exams/enem', { user: 'ana', locale: 'pt-BR' })
  const soon = (await screen.findByText('Trigonometria')).closest('li')
  expect(within(soon).getByText('em breve')).toBeInTheDocument()
  expect(within(soon).queryByRole('link')).not.toBeInTheDocument()
})

it('joins the track with an exam date', async () => {
  vi.mocked(getExam).mockResolvedValueOnce(examWith({ joined: false })).mockResolvedValueOnce(examWith({ examDate: '2027-11-07' }))
  renderAt('/exams/enem', { user: 'ana', locale: 'pt-BR' })
  expect(await screen.findByText('Estudar para o ENEM')).toBeInTheDocument()
  // The topics show before joining too.
  expect(screen.getByRole('link', { name: /Funções/ })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Data da prova (opcional)'), { target: { value: '2027-11-07' } })
  await userEvent.click(screen.getByRole('button', { name: 'Começar' }))
  expect(joinTrack).toHaveBeenCalledWith('enem', { examDate: '2027-11-07' }, 'token-ana')
  expect(await screen.findByText(/Prova em/)).toBeInTheDocument()
  expect(screen.queryByText('Estudar para o ENEM')).not.toBeInTheDocument()
})

it('joins without a date', async () => {
  vi.mocked(getExam).mockResolvedValueOnce(examWith({ joined: false }))
  renderAt('/exams/enem', { user: 'ana', locale: 'pt-BR' })
  await userEvent.click(await screen.findByRole('button', { name: 'Começar' }))
  expect(joinTrack).toHaveBeenCalledWith('enem', { examDate: null }, 'token-ana')
})

it('shows the server error', async () => {
  vi.mocked(getExam).mockRejectedValue(new Error('Prova não encontrada.'))
  renderAt('/exams/esa', { user: 'ana', locale: 'pt-BR' })
  expect(await screen.findByText('Prova não encontrada.')).toBeInTheDocument()
})

it('has a link in the menu', async () => {
  renderAt('/exams/enem', { user: 'ana', locale: 'pt-BR' })
  const nav = await screen.findByRole('navigation', { name: /principal|main/i })
  expect(within(nav).getByRole('link', { name: 'ENEM' })).toHaveAttribute('href', '/exams/enem')
})
